import { prisma } from '../../config/prisma';
import { ApiError } from '../../common/ApiError';
import { PageParams, buildMeta } from '../../common/pagination';
import { getSignedFileUrl } from '../../common/storage';

const listInclude = {
  classAssignments: { where: { isActive: true, deletedAt: null }, include: { class: true } },
};

const studentInclude = {
  ...listInclude,
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

export const studentsService = {
  async list(params: PageParams, status?: string) {
    const where: Record<string, unknown> = { deletedAt: null };
    if (status) where.status = status;
    if (params.search) {
      where.OR = [
        { fullName: { contains: params.search, mode: 'insensitive' } },
        { nis: { contains: params.search, mode: 'insensitive' } },
        { nisn: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: listInclude,
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
      include: { classAssignments: { where: { isActive: true, deletedAt: null }, include: { class: true } } },
    });
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
    return this.list(params, 'LULUS');
  },
};
