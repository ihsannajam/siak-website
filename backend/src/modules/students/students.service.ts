import { prisma } from '../../config/prisma';
import { ApiError } from '../../common/ApiError';
import { PageParams, buildMeta } from '../../common/pagination';
import { getSignedFileUrl } from '../../common/storage';

const activeClassInclude = {
  classAssignments: { where: { isActive: true, deletedAt: null }, include: { class: true } },
};

/** Kolom ringkas untuk daftar; NIK, kontak, dan alamat hanya ada di halaman detail. */
const summarySelect = {
  id: true,
  nis: true,
  nisn: true,
  fullName: true,
  nickname: true,
  gender: true,
  status: true,
  educationProgram: true,
  ...activeClassInclude,
};

const listSelect = {
  ...summarySelect,
  photoPath: true,
  // Tiga kolom berikut dan relasi family/documents hanya untuk menghitung kelengkapan.
  admissionType: true,
  livingWith: true,
  entryAcademicYear: { select: { id: true, name: true } },
  documents: { where: { deletedAt: null }, select: { docType: true } },
  family: { select: { guardianName: true, fatherLifeStatus: true, motherLifeStatus: true } },
};

const studentInclude = {
  ...activeClassInclude,
  family: true,
  healthRecord: true,
  entryAcademicYear: true,
  admissionClass: true,
  educationHistories: {
    where: { deletedAt: null },
    orderBy: [{ entryYear: 'asc' as const }, { createdAt: 'asc' as const }],
  },
};

/** Dokumen identitas hanya untuk pengguna yang boleh mengubah data siswa. */
export const SENSITIVE_DOC_TYPES = new Set([
  'AKTA_KELAHIRAN', 'KARTU_KELUARGA', 'KTP_AYAH', 'KTP_IBU', 'KTP_WALI', 'AKTA', 'KK',
]);

export const ALLOWED_DOC_TYPES = new Set([
  'AKTA_KELAHIRAN', 'KARTU_KELUARGA', 'KTP_AYAH', 'KTP_IBU', 'KTP_WALI',
  'IJAZAH_SKL', 'SURAT_PINDAH', 'PAS_FOTO', 'LAINNYA',
]);

/** Lokasi file tidak pernah dikirim ke browser; file dibuka lewat link sementara. */
export function toDocumentDto<T extends { filePath: string }>(doc: T): Omit<T, 'filePath'> {
  const { filePath: _filePath, ...rest } = doc;
  return rest;
}

export function stripStudentFiles<T extends Record<string, any>>(student: T) {
  const { photoPath: _photoPath, ...rest } = student;
  const out: Record<string, any> = rest;
  if (out.documents) out.documents = out.documents.map(toDocumentDto);
  return out;
}

/** Respons detail siswa dengan foto berupa link sementara. */
export async function presentStudent<T extends Record<string, any>>(student: T) {
  const photoUrl = student.photoPath
    ? await getSignedFileUrl(student.photoPath, 300).catch(() => null)
    : null;
  return { ...stripStudentFiles(student), photoUrl };
}

const SENSITIVE_FAMILY_FIELDS = [
  'fatherNik', 'fatherIncome', 'motherNik', 'motherIncome', 'guardianNik', 'guardianIncome',
] as const;

/** Menghapus NIK, penghasilan, dan dokumen identitas dari respons pengguna read-only. */
export function redactStudent<T extends Record<string, any>>(student: T): T {
  const copy: Record<string, any> = { ...student, nik: null };
  if (copy.family) {
    copy.family = { ...copy.family };
    for (const field of SENSITIVE_FAMILY_FIELDS) copy.family[field] = null;
  }
  if (copy.documents) {
    copy.documents = copy.documents.filter((d: { docType: string }) => !SENSITIVE_DOC_TYPES.has(d.docType));
  }
  return copy as T;
}

const LEGACY_DOC_TYPES: Record<string, string> = {
  AKTA: 'AKTA_KELAHIRAN',
  KK: 'KARTU_KELUARGA',
  IJAZAH: 'IJAZAH_SKL',
  FOTO: 'PAS_FOTO',
};

/** Dokumen "jika ada" hanya dihitung bila memang berlaku untuk siswa tersebut. */
export function getDocumentProgress(student: {
  admissionType?: string | null;
  livingWith?: string | null;
  documents?: { docType: string }[];
  family?: { guardianName?: string | null; fatherLifeStatus?: string | null; motherLifeStatus?: string | null } | null;
}) {
  const required = ['AKTA_KELAHIRAN', 'KARTU_KELUARGA', 'IJAZAH_SKL', 'PAS_FOTO'];
  if (student.family?.fatherLifeStatus !== 'MENINGGAL') required.push('KTP_AYAH');
  if (student.family?.motherLifeStatus !== 'MENINGGAL') required.push('KTP_IBU');
  if (student.family?.guardianName || student.livingWith === 'WALI') required.push('KTP_WALI');
  if (student.admissionType === 'PINDAHAN') required.push('SURAT_PINDAH');

  const uploaded = new Set((student.documents ?? []).map((d) => LEGACY_DOC_TYPES[d.docType] ?? d.docType));
  const missing = required.filter((type) => !uploaded.has(type));
  return { uploaded: required.length - missing.length, required: required.length, missing };
}

/** Baris tabel siswa. Data bantu kelengkapan tidak ikut dikirim ke browser. */
export async function presentStudentRow<T extends Record<string, any>>(student: T, canViewProgress: boolean) {
  const { documents: _documents, family: _family, admissionType: _admissionType, livingWith: _livingWith, photoPath, ...row } = student;
  const photoUrl = photoPath ? await getSignedFileUrl(photoPath, 300).catch(() => null) : null;
  return {
    ...row,
    photoUrl,
    ...(canViewProgress ? { documentProgress: getDocumentProgress(student) } : {}),
  };
}

export interface StudentFilters {
  status?: string;
  classId?: string;
  educationProgram?: string;
  entryAcademicYearId?: string;
  gender?: string;
  search?: string;
}

const STUDENT_STATUSES = new Set(['AKTIF', 'LULUS', 'PINDAH', 'DROP_OUT', 'NONAKTIF', 'MENGUNDURKAN_DIRI']);
const GENDERS = new Set(['LAKI_LAKI', 'PEREMPUAN']);

export function parseStudentFilters(query: Record<string, unknown>): StudentFilters {
  const text = (key: string) => (typeof query[key] === 'string' && query[key] ? (query[key] as string) : undefined);
  const filters: StudentFilters = {
    status: text('status'),
    classId: text('classId'),
    educationProgram: text('educationProgram'),
    entryAcademicYearId: text('entryAcademicYearId'),
    gender: text('gender'),
    search: text('search'),
  };
  if (filters.status && !STUDENT_STATUSES.has(filters.status)) throw ApiError.badRequest('Filter status tidak valid');
  if (filters.gender && !GENDERS.has(filters.gender)) throw ApiError.badRequest('Filter jenis kelamin tidak valid');
  return filters;
}

export function buildStudentWhere(filters: StudentFilters) {
  const where: Record<string, unknown> = { deletedAt: null };
  if (filters.status) where.status = filters.status;
  if (filters.gender) where.gender = filters.gender;
  if (filters.educationProgram) where.educationProgram = filters.educationProgram;
  if (filters.entryAcademicYearId) where.entryAcademicYearId = filters.entryAcademicYearId;
  if (filters.classId) {
    where.classAssignments = { some: { classId: filters.classId, isActive: true, deletedAt: null } };
  }
  if (filters.search) {
    where.OR = ['fullName', 'nickname', 'nis', 'nisn'].map((field) => ({
      [field]: { contains: filters.search, mode: 'insensitive' },
    }));
  }
  return where;
}

export const studentsService = {
  async list(params: PageParams, filters: StudentFilters = {}) {
    const where = buildStudentWhere({ ...filters, search: params.search || filters.search });
    const [items, total] = await Promise.all([
      prisma.student.findMany({
        where,
        select: listSelect,
        orderBy: params.sortBy ? { [params.sortBy]: params.sortOrder } : { fullName: 'asc' },
        skip: params.skip,
        take: params.limit,
      }),
      prisma.student.count({ where }),
    ]);
    return { items, meta: buildMeta(total, params) };
  },

  async findAll(status?: string) {
    const where: Record<string, unknown> = { deletedAt: null };
    if (status) where.status = status;
    return prisma.student.findMany({
      where,
      orderBy: { fullName: 'asc' },
      select: summarySelect,
    });
  },

  /** Pilihan filter tabel, hanya dari data siswa yang boleh dilihat lewat students.read. */
  async filterOptions() {
    const [classes, years, programs] = await Promise.all([
      prisma.class.findMany({
        where: { deletedAt: null, classAssignments: { some: { isActive: true, deletedAt: null, student: { deletedAt: null } } } },
        select: { id: true, name: true, academicYear: { select: { name: true } } },
        orderBy: { name: 'asc' },
      }),
      prisma.academicYear.findMany({
        where: { deletedAt: null, entryStudents: { some: { deletedAt: null } } },
        select: { id: true, name: true },
        orderBy: { name: 'desc' },
      }),
      prisma.student.findMany({
        where: { deletedAt: null, educationProgram: { not: null } },
        distinct: ['educationProgram'],
        select: { educationProgram: true },
        orderBy: { educationProgram: 'asc' },
      }),
    ]);
    return {
      classes: classes.map((c) => ({ value: c.id, label: `${c.name} (${c.academicYear.name})` })),
      academicYears: years.map((y) => ({ value: y.id, label: y.name })),
      programs: programs.map((p) => ({ value: p.educationProgram!, label: p.educationProgram! })),
    };
  },

  async getById(id: string) {
    const student = await prisma.student.findFirst({
      where: { id, deletedAt: null },
      include: { ...studentInclude, documents: { where: { deletedAt: null } } },
    });
    if (!student) throw ApiError.notFound('Siswa tidak ditemukan');
    return student;
  },

  async create(data: any, userId?: string) {
    const { family, health, educationHistories, ...student } = data;
    return prisma.student.create({
      data: {
        ...student,
        createdBy: userId,
        ...(educationHistories?.length
          ? {
              educationHistories: {
                create: educationHistories.map(({ id: _id, ...h }: any) => ({ ...h, createdBy: userId })),
              },
            }
          : {}),
        ...(family ? { family: { create: { ...family, createdBy: userId } } } : {}),
        ...(health ? { healthRecord: { create: { ...health, createdBy: userId } } } : {}),
      },
      include: studentInclude,
    });
  },

  async update(id: string, data: any, userId?: string) {
    await this.getById(id);
    const { family, health, educationHistories, ...student } = data;
    return prisma.$transaction(async (tx) => {
      if (educationHistories) {
        const current = await tx.studentEducationHistory.findMany({
          where: { studentId: id, deletedAt: null },
          select: { id: true },
        });
        const currentIds = new Set(current.map((h) => h.id));
        const keptIds = new Set<string>();

        for (const { id: historyId, ...history } of educationHistories) {
          if (historyId && currentIds.has(historyId)) {
            keptIds.add(historyId);
            await tx.studentEducationHistory.update({
              where: { id: historyId },
              data: { ...history, updatedBy: userId },
            });
          } else {
            await tx.studentEducationHistory.create({
              data: { ...history, studentId: id, createdBy: userId },
            });
          }
        }
        const removed = [...currentIds].filter((historyId) => !keptIds.has(historyId));
        if (removed.length) {
          await tx.studentEducationHistory.updateMany({
            where: { id: { in: removed } },
            data: { deletedAt: new Date(), updatedBy: userId },
          });
        }
      }

      return tx.student.update({
        where: { id },
        data: {
          ...student,
          updatedBy: userId,
          ...(family
            ? { family: { upsert: { create: { ...family, createdBy: userId }, update: { ...family, updatedBy: userId } } } }
            : {}),
          ...(health
            ? { healthRecord: { upsert: { create: { ...health, createdBy: userId }, update: { ...health, updatedBy: userId } } } }
            : {}),
        },
        include: studentInclude,
      });
    });
  },

  async remove(id: string, userId?: string) {
    await this.getById(id);
    return prisma.student.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: userId },
    });
  },

  /** Bulk class promotion: deactivate old assignment, create new one. */
  async bulkPromote(studentIds: string[], targetClassId: string, userId?: string) {
    const cls = await prisma.class.findFirst({ where: { id: targetClassId, deletedAt: null } });
    if (!cls) throw ApiError.notFound('Kelas tujuan tidak ditemukan');

    return prisma.$transaction(async (tx) => {
      await tx.studentClassAssignment.updateMany({
        where: { studentId: { in: studentIds }, isActive: true },
        data: { isActive: false, updatedBy: userId },
      });
      await tx.studentClassAssignment.createMany({
        data: studentIds.map((studentId) => ({
          studentId,
          classId: targetClassId,
          isActive: true,
          createdBy: userId,
        })),
      });
      return { promoted: studentIds.length, targetClassId };
    });
  },

  /**
   * Business Rule #7: graduating students move to alumni (status LULUS), never
   * deleted. Their active class assignment is closed.
   */
  async graduate(studentIds: string[], userId?: string) {
    return prisma.$transaction(async (tx) => {
      await tx.student.updateMany({
        where: { id: { in: studentIds }, deletedAt: null },
        data: { status: 'LULUS', updatedBy: userId },
      });
      await tx.studentClassAssignment.updateMany({
        where: { studentId: { in: studentIds }, isActive: true },
        data: { isActive: false, updatedBy: userId },
      });
      return { graduated: studentIds.length };
    });
  },

  async listAlumni(params: PageParams) {
    return this.list(params, { status: 'LULUS' });
  },
};
