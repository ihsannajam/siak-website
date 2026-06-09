import { prisma } from '../../config/prisma';
import { ApiError } from '../../common/ApiError';
import { PageParams, buildMeta } from '../../common/pagination';

/** Generates a registration number: PPDB-YYYY-#### */
async function nextRegistrationNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.ppdbRegistration.count({
    where: { registrationNumber: { startsWith: `PPDB-${year}-` } },
  });
  return `PPDB-${year}-${String(count + 1).padStart(4, '0')}`;
}

/** Generates a NIS for an accepted student: YY + sequential. */
async function nextNis(): Promise<string> {
  const yy = String(new Date().getFullYear()).slice(2);
  const count = await prisma.student.count({ where: { nis: { startsWith: yy } } });
  return `${yy}${String(count + 1).padStart(4, '0')}`;
}

const ppdbInclude = {
  documents: { where: { deletedAt: null } },
  scorecards: { where: { deletedAt: null } },
  payments: { where: { deletedAt: null } },
  schedules: { where: { deletedAt: null } },
};

export const ppdbService = {
  async list(params: PageParams, status?: string) {
    const where: Record<string, unknown> = { deletedAt: null };
    if (status) where.status = status;
    if (params.search) {
      where.OR = [
        { fullName: { contains: params.search, mode: 'insensitive' } },
        { registrationNumber: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      prisma.ppdbRegistration.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.limit,
      }),
      prisma.ppdbRegistration.count({ where }),
    ]);
    return { items, meta: buildMeta(total, params) };
  },

  async getById(id: string) {
    const reg = await prisma.ppdbRegistration.findFirst({
      where: { id, deletedAt: null },
      include: ppdbInclude,
    });
    if (!reg) throw ApiError.notFound('Pendaftaran tidak ditemukan');
    return reg;
  },

  async create(data: any, userId?: string) {
    const registrationNumber = await nextRegistrationNumber();
    const reg = await prisma.ppdbRegistration.create({
      data: { ...data, registrationNumber, createdBy: userId },
    });
    await prisma.ppdbActivityLog.create({
      data: { registrationId: reg.id, activity: 'PENDAFTARAN', detail: `Nomor ${registrationNumber}`, actorId: userId, createdBy: userId },
    });
    return reg;
  },

  async update(id: string, data: any, userId?: string) {
    await this.getById(id);
    return prisma.ppdbRegistration.update({ where: { id }, data: { ...data, updatedBy: userId } });
  },

  async remove(id: string, userId?: string) {
    await this.getById(id);
    return prisma.ppdbRegistration.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: userId },
    });
  },

  async verifyDocument(documentId: string, isVerified: boolean, userId?: string) {
    const doc = await prisma.ppdbDocument.findFirst({ where: { id: documentId, deletedAt: null } });
    if (!doc) throw ApiError.notFound('Dokumen tidak ditemukan');
    const updated = await prisma.ppdbDocument.update({
      where: { id: documentId },
      data: { isVerified, verifiedAt: isVerified ? new Date() : null, updatedBy: userId },
    });
    await prisma.ppdbActivityLog.create({
      data: {
        registrationId: doc.registrationId,
        activity: 'VERIFIKASI_DOKUMEN',
        detail: `${doc.docType} -> ${isVerified ? 'terverifikasi' : 'ditolak'}`,
        actorId: userId,
        createdBy: userId,
      },
    });
    return updated;
  },

  async setSelectionResult(id: string, status: string, note: string | undefined, userId?: string) {
    const allowed = ['DITERIMA', 'CADANGAN', 'TIDAK_DITERIMA', 'SUDAH_SELEKSI', 'SEDANG_DIPROSES'];
    if (!allowed.includes(status)) throw ApiError.badRequest('Status hasil seleksi tidak valid');
    const reg = await this.getById(id);
    const updated = await prisma.ppdbRegistration.update({
      where: { id: reg.id },
      data: { status: status as any, notes: note, updatedBy: userId },
    });
    await prisma.ppdbActivityLog.create({
      data: { registrationId: id, activity: 'HASIL_SELEKSI', detail: status, actorId: userId, createdBy: userId },
    });
    return updated;
  },

  /**
   * Business Rule #6: only ACCEPTED (DITERIMA) registrants may be synced to the
   * student master, and re-running is idempotent (ppdbId is unique on Student).
   */
  async syncToStudent(id: string, userId?: string) {
    const reg = await this.getById(id);
    if (reg.status !== 'DITERIMA') {
      throw ApiError.unprocessable('Hanya calon siswa berstatus DITERIMA yang dapat disinkronkan');
    }
    const existing = await prisma.student.findUnique({ where: { ppdbId: reg.id } });
    if (existing) throw ApiError.conflict('Calon siswa ini sudah disinkronkan sebelumnya');

    const nis = await nextNis();
    const student = await prisma.student.create({
      data: {
        nis,
        fullName: reg.fullName,
        birthPlace: reg.birthPlace,
        birthDate: reg.birthDate,
        gender: reg.gender,
        address: reg.address,
        status: 'AKTIF',
        ppdbId: reg.id,
        createdBy: userId,
        family: {
          create: {
            fatherName: reg.fatherName,
            motherName: reg.motherName,
            guardianName: reg.guardianName,
            guardianPhone: reg.guardianPhone,
            createdBy: userId,
          },
        },
        healthRecord: {
          create: {
            bloodType: reg.bloodType,
            diseaseHistory: reg.diseaseHistory,
            allergies: reg.allergies,
            createdBy: userId,
          },
        },
      },
    });
    await prisma.ppdbActivityLog.create({
      data: { registrationId: id, activity: 'SINKRONISASI_SISWA', detail: `NIS ${nis}`, actorId: userId, createdBy: userId },
    });
    return { student, nis };
  },

  async logs(id: string) {
    return prisma.ppdbActivityLog.findMany({
      where: { registrationId: id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  },
};
