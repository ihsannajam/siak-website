import { Prisma } from '@prisma/client';
import { Request, Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middlewares/auth';
import { requirePermission } from '../../middlewares/rbac';
import { validate } from '../../middlewares/validate';
import { getSignedFileUrl, upload, uploadPrivate } from '../../common/storage';
import { writeAudit } from '../../common/audit';
import { asyncHandler } from '../../common/asyncHandler';
import { success, created } from '../../common/apiResponse';
import { buildMeta, getPageParams } from '../../common/pagination';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../common/ApiError';

const blankToNull = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? null : value;
const text = z.preprocess(blankToNull, z.string().trim().max(500).nullable().optional());
const longText = z.preprocess(blankToNull, z.string().trim().max(5000).nullable().optional());
const date = z.preprocess(blankToNull, z.coerce.date().nullable().optional());
const year = z.preprocess(blankToNull, z.coerce.number().int().min(1900).max(2100).nullable().optional());
const choice = <T extends [string, ...string[]]>(values: T) =>
  z.preprocess(blankToNull, z.enum(values).nullable().optional());

const CATEGORIES = ['GURU', 'TENAGA_KEPENDIDIKAN', 'KARYAWAN'] as const;
const ACTIVE_STATUSES = ['AKTIF', 'CUTI', 'NONAKTIF', 'KELUAR'] as const;
const EMPLOYMENT_STATUSES = ['TETAP', 'KONTRAK', 'HONORER'] as const;

const trainingSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'Nama pelatihan wajib diisi').max(300),
  organizer: text,
  year,
  certificateNumber: text,
});

const employeeFields = {
  nip: text,
  nuptk: text,
  nik: z.preprocess(blankToNull, z.string().trim().regex(/^\d{16}$/, 'NIK harus 16 digit angka').nullable().optional()),
  gender: z.preprocess(blankToNull, z.enum(['LAKI_LAKI', 'PEREMPUAN']).nullable().optional()),
  birthPlace: text,
  birthDate: date,
  religion: text,
  maritalStatus: text,
  address: longText,
  phone: text,
  email: z.preprocess(blankToNull, z.string().trim().email('Format email tidak valid').nullable().optional()),
  personnelCategory: choice([...CATEGORIES]),
  employmentStatus: z.enum(EMPLOYMENT_STATUSES).optional(),
  workStartDate: date,
  appointmentDecreeNumber: text,
  activeStatus: z.enum(ACTIVE_STATUSES).optional(),
  lastEducation: text,
  studyProgram: text,
  institutionName: text,
  graduationYear: year,
  academicTitle: text,
  certification: text,
  educationHistory: longText,
  additionalDuties: longText,
  bankName: text,
  bankAccount: text,
  trainings: z.array(trainingSchema).max(100).optional(),
};

export const employeeSchema = z.object({
  fullName: z.string().trim().min(1, 'Nama lengkap wajib diisi').max(200),
  position: z.string().trim().min(1, 'Jabatan wajib diisi').max(200),
  ...employeeFields,
});

const salarySchema = z.object({
  name: z.string().min(1),
  type: z.enum(['TUNJANGAN', 'POTONGAN', 'GAJI_POKOK']),
  amount: z.coerce.number().nonnegative(),
});

/** Data ini hanya untuk pengguna yang berhak mengubah data pegawai. */
const PERSONAL_FIELDS = [
  'nik', 'birthPlace', 'birthDate', 'religion', 'maritalStatus', 'address', 'phone', 'email',
  'bankName', 'bankAccount', 'salaryComponents',
] as const;

const REQUIRED_DOCUMENTS = ['KTP', 'KK', 'IJAZAH', 'SK', 'SERTIFIKAT'];
const ALLOWED_DOC_TYPES = new Set([...REQUIRED_DOCUMENTS, 'FOTO', 'NPWP', 'BUKU_TABUNGAN', 'LAINNYA']);
const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DOCUMENT_MIME = new Set([...IMAGE_MIME, 'application/pdf']);

const listSelect = {
  id: true, nip: true, nuptk: true, fullName: true, gender: true, position: true, personnelCategory: true,
  employmentStatus: true, activeStatus: true, workStartDate: true, photoPath: true,
  documents: { where: { deletedAt: null }, select: { docType: true } },
} satisfies Prisma.EmployeeSelect;

const canManage = (req: Request) => !!req.user?.permissions.includes('employees.update');
const photoUrlOf = (photoPath?: string | null) =>
  photoPath ? getSignedFileUrl(photoPath, 300).catch(() => null) : Promise.resolve(null);

function documentProgress(documents: { docType: string }[]) {
  const uploaded = new Set(documents.map((d) => d.docType));
  const missing = REQUIRED_DOCUMENTS.filter((type) => !uploaded.has(type));
  return { uploaded: REQUIRED_DOCUMENTS.length - missing.length, required: REQUIRED_DOCUMENTS.length, missing };
}

function buildWhere(req: Request, search?: string): Prisma.EmployeeWhereInput {
  const where: Prisma.EmployeeWhereInput = { deletedAt: null };
  const { personnelCategory, employmentStatus, activeStatus } = req.query;
  if (typeof personnelCategory === 'string' && (CATEGORIES as readonly string[]).includes(personnelCategory)) {
    where.personnelCategory = personnelCategory;
  }
  if (typeof employmentStatus === 'string' && (EMPLOYMENT_STATUSES as readonly string[]).includes(employmentStatus)) {
    where.employmentStatus = employmentStatus as (typeof EMPLOYMENT_STATUSES)[number];
  }
  if (typeof activeStatus === 'string' && (ACTIVE_STATUSES as readonly string[]).includes(activeStatus)) {
    where.activeStatus = activeStatus;
  }
  if (search) {
    const contains = { contains: search, mode: 'insensitive' as const };
    where.OR = [
      { fullName: contains }, { nip: contains }, { nuptk: contains }, { position: contains },
      // Pencarian NIK dibatasi agar tidak bisa dipakai menebak NIK seseorang.
      ...(canManage(req) ? [{ nik: contains }] : []),
    ];
  }
  return where;
}

const minutesOf = (time: string) => {
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

/** Penugasan dibaca dari Mapping Guru-Mapel, Rombel, dan jadwal terbit semester aktif. */
async function getAssignments(employeeId: string) {
  const activeSemester = await prisma.semester.findFirst({
    where: { isActive: true, deletedAt: null, academicYear: { isActive: true, deletedAt: null } },
    select: { id: true },
  });
  const [mappedSubjects, homeroomClasses, details] = await Promise.all([
    prisma.teacherSubjectAssignment.findMany({
      where: { employeeId, deletedAt: null, subject: { deletedAt: null } },
      select: { subject: { select: { name: true } } },
    }),
    prisma.class.findMany({
      where: { homeroomTeacherId: employeeId, deletedAt: null, academicYear: { isActive: true } },
      select: { name: true },
      orderBy: { name: 'asc' },
    }),
    activeSemester
      ? prisma.scheduleDetail.findMany({
        where: {
          teacherId: employeeId,
          deletedAt: null,
          schedule: { status: 'PUBLISHED', deletedAt: null, semesterId: activeSemester.id },
        },
        select: {
          id: true, dayOfWeek: true, startTime: true, endTime: true,
          subject: { select: { name: true } },
          class: { select: { name: true } },
          classroom: { select: { name: true } },
        },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      })
      : Promise.resolve([]),
  ]);
  const minutes = details.reduce((total, d) => {
    const start = minutesOf(d.startTime);
    const end = minutesOf(d.endTime);
    return start !== null && end !== null && end > start ? total + end - start : total;
  }, 0);
  const unique = (values: (string | undefined)[]) =>
    [...new Set(values.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b));
  return {
    subjects: unique([...mappedSubjects.map((s) => s.subject.name), ...details.map((d) => d.subject?.name)]),
    classes: unique(details.map((d) => d.class?.name)),
    homeroomClasses: homeroomClasses.map((c) => c.name),
    teachingHoursPerWeek: Math.round((minutes / 60) * 10) / 10,
    schedule: details.map((d) => ({
      id: d.id,
      dayOfWeek: d.dayOfWeek,
      startTime: d.startTime,
      endTime: d.endTime,
      subject: d.subject?.name ?? null,
      className: d.class?.name ?? null,
      classroom: d.classroom?.name ?? null,
    })),
  };
}

async function presentEmployee(req: Request, id: string) {
  const employee = await prisma.employee.findFirst({
    where: { id, deletedAt: null },
    include: {
      salaryComponents: { where: { deletedAt: null } },
      trainings: { where: { deletedAt: null }, orderBy: [{ year: 'desc' }, { createdAt: 'asc' }] },
      documents: { where: { deletedAt: null }, select: { docType: true } },
    },
  });
  if (!employee) throw ApiError.notFound('Pegawai tidak ditemukan');
  const { photoPath, documents, ...rest } = employee;
  const [photoUrl, assignments] = await Promise.all([photoUrlOf(photoPath), getAssignments(id)]);
  const out: Record<string, unknown> = { ...rest, photoUrl, assignments };
  if (canManage(req)) out.documentProgress = documentProgress(documents);
  else for (const field of PERSONAL_FIELDS) delete out[field];
  return out;
}

type TrainingInput = z.infer<typeof trainingSchema>;

async function syncTrainings(tx: Prisma.TransactionClient, employeeId: string, trainings: TrainingInput[], userId: string) {
  const existing = await tx.employeeTraining.findMany({ where: { employeeId, deletedAt: null }, select: { id: true } });
  const existingIds = new Set(existing.map((t) => t.id));
  const keptIds = new Set(trainings.flatMap((t) => (t.id && existingIds.has(t.id) ? [t.id] : [])));
  await tx.employeeTraining.updateMany({
    where: { employeeId, deletedAt: null, id: { notIn: [...keptIds] } },
    data: { deletedAt: new Date(), updatedBy: userId },
  });
  for (const { id, ...data } of trainings) {
    if (id && keptIds.has(id)) await tx.employeeTraining.update({ where: { id }, data: { ...data, updatedBy: userId } });
    else await tx.employeeTraining.create({ data: { ...data, employeeId, createdBy: userId } });
  }
}

/** Lokasi file tidak pernah dikirim ke browser. */
const toDocumentDto = <T extends { filePath: string }>({ filePath: _filePath, ...doc }: T) => doc;

const router = Router();
router.use(authenticate);

router.get(
  '/',
  requirePermission('employees.read'),
  asyncHandler(async (req, res) => {
    // Untuk dropdown: cukup identitas ringkas.
    if (req.query.all === 'true') {
      const items = await prisma.employee.findMany({
        where: { deletedAt: null },
        select: { id: true, nip: true, fullName: true, position: true },
        orderBy: { fullName: 'asc' },
      });
      return success(res, items);
    }
    const params = getPageParams(req);
    const where = buildWhere(req, params.search);
    const [rows, total] = await Promise.all([
      prisma.employee.findMany({ where, select: listSelect, orderBy: { fullName: 'asc' }, skip: params.skip, take: params.limit }),
      prisma.employee.count({ where }),
    ]);
    const manage = canManage(req);
    const items = await Promise.all(rows.map(async ({ photoPath, documents, ...row }) => ({
      ...row,
      photoUrl: await photoUrlOf(photoPath),
      ...(manage ? { documentProgress: documentProgress(documents) } : {}),
    })));
    return success(res, items, 'Berhasil', 200, buildMeta(total, params));
  }),
);

router.get(
  '/:id',
  requirePermission('employees.read'),
  asyncHandler(async (req, res) => success(res, await presentEmployee(req, req.params.id))),
);

router.post(
  '/',
  requirePermission('employees.create'),
  validate(employeeSchema),
  asyncHandler(async (req, res) => {
    const { trainings, ...data } = req.body;
    const userId = req.user!.id;
    const employee = await prisma.$transaction(async (tx) => {
      const row = await tx.employee.create({ data: { ...data, createdBy: userId } });
      if (trainings) await syncTrainings(tx, row.id, trainings, userId);
      return row;
    });
    await writeAudit({ req, action: 'CREATE', module: 'employees', entityId: employee.id });
    return created(res, await presentEmployee(req, employee.id));
  }),
);

router.put(
  '/:id',
  requirePermission('employees.update'),
  validate(employeeSchema.partial()),
  asyncHandler(async (req, res) => {
    const { trainings, ...data } = req.body;
    const userId = req.user!.id;
    const existing = await prisma.employee.findFirst({ where: { id: req.params.id, deletedAt: null }, select: { id: true } });
    if (!existing) throw ApiError.notFound('Pegawai tidak ditemukan');
    await prisma.$transaction(async (tx) => {
      await tx.employee.update({ where: { id: existing.id }, data: { ...data, updatedBy: userId } });
      if (trainings) await syncTrainings(tx, existing.id, trainings, userId);
    });
    await writeAudit({ req, action: 'UPDATE', module: 'employees', entityId: existing.id });
    return success(res, await presentEmployee(req, existing.id), 'Data berhasil diperbarui');
  }),
);

router.delete(
  '/:id',
  requirePermission('employees.delete'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.employee.findFirst({ where: { id: req.params.id, deletedAt: null }, select: { id: true } });
    if (!existing) throw ApiError.notFound('Pegawai tidak ditemukan');
    await prisma.employee.update({ where: { id: existing.id }, data: { deletedAt: new Date(), updatedBy: req.user!.id } });
    await writeAudit({ req, action: 'DELETE', module: 'employees', entityId: existing.id });
    return success(res, null, 'Data berhasil dihapus');
  }),
);

// ---- Extra: document upload ----
router.post(
  '/:id/documents',
  requirePermission('employees.update'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('File tidak ditemukan');
    const docType = req.body.docType ?? 'LAINNYA';
    if (!ALLOWED_DOC_TYPES.has(docType)) throw ApiError.badRequest('Jenis dokumen tidak valid');
    const allowedMime = docType === 'FOTO' ? IMAGE_MIME : DOCUMENT_MIME;
    if (!allowedMime.has(req.file.mimetype)) {
      throw ApiError.badRequest(docType === 'FOTO' ? 'Foto harus JPG, PNG, atau WEBP' : 'Dokumen harus PDF, JPG, PNG, atau WEBP');
    }
    const employee = await prisma.employee.findFirst({
      where: { id: req.params.id, deletedAt: null },
      select: { id: true },
    });
    if (!employee) throw ApiError.notFound('Pegawai tidak ditemukan');
    const filePath = await uploadPrivate(req.file, `employees/${employee.id}`);
    const doc = await prisma.employeeDocument.create({
      data: {
        employeeId: employee.id,
        docType,
        fileName: req.file.originalname,
        filePath,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        createdBy: req.user!.id,
      },
    });
    if (docType === 'FOTO') {
      await prisma.employee.update({ where: { id: employee.id }, data: { photoPath: filePath, updatedBy: req.user!.id } });
    }
    await writeAudit({ req, action: 'UPLOAD_DOCUMENT', module: 'employees', entityId: employee.id, detail: doc.docType });
    return created(res, toDocumentDto(doc), 'Dokumen pegawai diunggah');
  }),
);

router.get(
  '/:id/documents',
  requirePermission('employees.update'),
  asyncHandler(async (req, res) => {
    const docs = await prisma.employeeDocument.findMany({
      where: { employeeId: req.params.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return success(res, docs.map(toDocumentDto));
  }),
);

// Link sementara (60 detik) untuk membuka satu dokumen pegawai.
router.get(
  '/:id/documents/:docId/url',
  requirePermission('employees.update'),
  asyncHandler(async (req, res) => {
    const doc = await prisma.employeeDocument.findFirst({
      where: {
        id: req.params.docId,
        employeeId: req.params.id,
        deletedAt: null,
        employee: { deletedAt: null },
      },
    });
    if (!doc) throw ApiError.notFound('Dokumen tidak ditemukan');
    const url = await getSignedFileUrl(doc.filePath, 60);
    await writeAudit({ req, action: 'VIEW_DOCUMENT', module: 'employees', entityId: doc.employeeId, detail: doc.docType });
    res.setHeader('Cache-Control', 'no-store');
    return success(res, { url, expiresIn: 60 });
  }),
);

// ---- Extra: salary components ----
router.post(
  '/:id/salary-components',
  requirePermission('employees.update'),
  validate(salarySchema),
  asyncHandler(async (req, res) => {
    const comp = await prisma.employeeSalaryComponent.create({
      data: { employeeId: req.params.id, ...req.body, createdBy: req.user!.id },
    });
    return created(res, comp, 'Komponen gaji ditambahkan');
  }),
);

router.get(
  '/:id/salary-components',
  requirePermission('employees.read'),
  asyncHandler(async (req, res) => {
    const comps = await prisma.employeeSalaryComponent.findMany({
      where: { employeeId: req.params.id, deletedAt: null },
    });
    return success(res, comps);
  }),
);

export default router;
