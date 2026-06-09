import { prisma } from '../../config/prisma';
import { ApiError } from '../../common/ApiError';
import { PageParams, buildMeta } from '../../common/pagination';

const studentInclude = {
  family: true,
  healthRecord: true,
  classAssignments: { where: { isActive: true, deletedAt: null }, include: { class: true } },
};

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
        include: studentInclude,
        orderBy: params.sortBy ? { [params.sortBy]: params.sortOrder } : { fullName: 'asc' },
        skip: params.skip,
        take: params.limit,
      }),
      prisma.student.count({ where }),
    ]);
    return { items, meta: buildMeta(total, params) };
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
    const { family, health, ...student } = data;
    return prisma.student.create({
      data: {
        ...student,
        createdBy: userId,
        ...(family ? { family: { create: { ...family, createdBy: userId } } } : {}),
        ...(health ? { healthRecord: { create: { ...health, createdBy: userId } } } : {}),
      },
      include: studentInclude,
    });
  },

  async update(id: string, data: any, userId?: string) {
    await this.getById(id);
    const { family, health, ...student } = data;
    return prisma.student.update({
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
