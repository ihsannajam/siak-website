import { Router } from 'express';
import { z } from 'zod';
import { createCrudRouter } from '../../common/crudRouter';
import { authenticate } from '../../middlewares/auth';
import { requirePermission } from '../../middlewares/rbac';
import { validate } from '../../middlewares/validate';
import { getSignedFileUrl, upload, uploadPrivate } from '../../common/storage';
import { writeAudit } from '../../common/audit';
import { asyncHandler } from '../../common/asyncHandler';
import { success, created } from '../../common/apiResponse';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../common/ApiError';

const optionalString = z.string().trim().optional().nullable();

export const employeeSchema = z.object({
  nip: optionalString,
  nuptk: optionalString,
  nik: optionalString,
  fullName: z.string().min(1, 'Nama lengkap wajib diisi'),
  gender: z.enum(['LAKI_LAKI', 'PEREMPUAN']).optional().nullable(),
  birthPlace: optionalString,
  birthDate: z.coerce.date().optional().nullable(),
  address: optionalString,
  phone: optionalString,
  email: z.string().email().optional().nullable().or(z.literal('')),
  position: z.string().min(1, 'Jabatan wajib diisi'),
  employmentStatus: z.enum(['TETAP', 'KONTRAK', 'HONORER']).optional(),
  educationHistory: optionalString,
  certification: optionalString,
  bankName: optionalString,
  bankAccount: optionalString,
});

const salarySchema = z.object({
  name: z.string().min(1),
  type: z.enum(['TUNJANGAN', 'POTONGAN', 'GAJI_POKOK']),
  amount: z.coerce.number().nonnegative(),
});

/** Lokasi file tidak pernah dikirim ke browser. */
const toDocumentDto = <T extends { filePath: string }>({ filePath: _filePath, ...doc }: T) => doc;

// Base CRUD via factory
const router = createCrudRouter({
  permissionKey: 'employees',
  modelName: 'employee',
  searchFields: ['fullName', 'nip', 'nuptk', 'nik', 'position'],
  defaultSort: { fullName: 'asc' },
  include: { salaryComponents: { where: { deletedAt: null } } },
  createSchema: employeeSchema,
  updateSchema: employeeSchema.partial(),
});

// ---- Extra: document upload ----
router.post(
  '/:id/documents',
  authenticate,
  requirePermission('employees.update'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('File tidak ditemukan');
    const employee = await prisma.employee.findFirst({
      where: { id: req.params.id, deletedAt: null },
      select: { id: true },
    });
    if (!employee) throw ApiError.notFound('Pegawai tidak ditemukan');
    const filePath = await uploadPrivate(req.file, `employees/${employee.id}`);
    const doc = await prisma.employeeDocument.create({
      data: {
        employeeId: req.params.id,
        docType: req.body.docType ?? 'LAINNYA',
        fileName: req.file.originalname,
        filePath,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        createdBy: req.user!.id,
      },
    });
    await writeAudit({ req, action: 'UPLOAD_DOCUMENT', module: 'employees', entityId: employee.id, detail: doc.docType });
    return created(res, toDocumentDto(doc), 'Dokumen pegawai diunggah');
  }),
);

router.get(
  '/:id/documents',
  authenticate,
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
  authenticate,
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
  authenticate,
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
  authenticate,
  requirePermission('employees.read'),
  asyncHandler(async (req, res) => {
    const comps = await prisma.employeeSalaryComponent.findMany({
      where: { employeeId: req.params.id, deletedAt: null },
    });
    return success(res, comps);
  }),
);

export default router;
