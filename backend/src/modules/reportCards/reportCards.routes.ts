import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middlewares/auth';
import { requirePermission } from '../../middlewares/rbac';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../common/asyncHandler';
import { success, created } from '../../common/apiResponse';
import { getPageParams, buildMeta } from '../../common/pagination';
import { writeAudit } from '../../common/audit';
import { ApiError } from '../../common/ApiError';
import { prisma } from '../../config/prisma';
import { streamReportCardPdf } from '../../common/pdf';

const router = Router();
router.use(authenticate);

const generateSchema = z.object({
  studentId: z.string().uuid(),
  classId: z.string().uuid().optional().nullable(),
  semesterId: z.string().uuid(),
  attitudeNote: z.string().optional().nullable(),
  teacherNote: z.string().optional().nullable(),
});

// ---- List / detail ----
router.get('/', requirePermission('report-cards.read'), asyncHandler(async (req, res) => {
  const params = getPageParams(req);
  const where: Record<string, unknown> = { deletedAt: null };
  if (req.query.semesterId) where.semesterId = req.query.semesterId;
  if (req.query.studentId) where.studentId = req.query.studentId;
  if (req.query.status) where.status = req.query.status;
  const [items, total] = await Promise.all([
    prisma.reportCard.findMany({ where, include: { student: true, class: true }, orderBy: { createdAt: 'desc' }, skip: params.skip, take: params.limit }),
    prisma.reportCard.count({ where }),
  ]);
  return success(res, items, 'Berhasil', 200, buildMeta(total, params));
}));

router.get('/:id', requirePermission('report-cards.read'), asyncHandler(async (req, res) => {
  const item = await prisma.reportCard.findFirst({ where: { id: req.params.id, deletedAt: null }, include: { student: true, class: true } });
  if (!item) throw ApiError.notFound('Rapor tidak ditemukan');
  return success(res, item);
}));

/**
 * POST /report-cards/generate
 * Aggregates a student's grades for the semester into a report card (average).
 */
router.post('/generate', requirePermission('report-cards.create'), validate(generateSchema), asyncHandler(async (req, res) => {
  const { studentId, semesterId, classId, attitudeNote, teacherNote } = req.body;

  const grades = await prisma.grade.findMany({ where: { studentId, semesterId, deletedAt: null } });
  if (!grades.length) throw ApiError.unprocessable('Belum ada nilai untuk siswa pada semester ini');
  const average = grades.reduce((sum, g) => sum + g.score, 0) / grades.length;

  // upsert-like: one report card per student+semester
  const existing = await prisma.reportCard.findFirst({ where: { studentId, semesterId, deletedAt: null } });
  if (existing && existing.status === 'LOCKED') {
    throw ApiError.unprocessable('Rapor sudah dikunci, tidak dapat di-generate ulang');
  }

  const data = {
    studentId,
    classId,
    semesterId,
    averageScore: Math.round(average * 100) / 100,
    attitudeNote,
    teacherNote,
    status: 'DRAFT' as const,
  };

  const card = existing
    ? await prisma.reportCard.update({ where: { id: existing.id }, data: { ...data, updatedBy: req.user!.id } })
    : await prisma.reportCard.create({ data: { ...data, createdBy: req.user!.id } });

  await writeAudit({ req, action: 'GENERATE_REPORT_CARD', module: 'report-cards', entityId: card.id });
  return created(res, card, 'E-rapor berhasil di-generate');
}));

// ---- Submit (guru -> wali kelas/TU) ----
router.post('/:id/submit', requirePermission('report-cards.update'), asyncHandler(async (req, res) => {
  const card = await prisma.reportCard.update({ where: { id: req.params.id }, data: { status: 'SUBMITTED', updatedBy: req.user!.id } });
  return success(res, card, 'Rapor dikirim untuk direview');
}));

/**
 * POST /report-cards/:id/lock
 * Locks the report card AND all underlying grades (Business Rule #8).
 */
router.post('/:id/lock', requirePermission('report-cards.update'), asyncHandler(async (req, res) => {
  const card = await prisma.reportCard.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!card) throw ApiError.notFound('Rapor tidak ditemukan');
  await prisma.$transaction([
    prisma.reportCard.update({ where: { id: card.id }, data: { status: 'LOCKED', lockedAt: new Date(), updatedBy: req.user!.id } }),
    prisma.grade.updateMany({ where: { studentId: card.studentId, semesterId: card.semesterId, deletedAt: null }, data: { isLocked: true, updatedBy: req.user!.id } }),
  ]);
  await writeAudit({ req, action: 'LOCK_REPORT_CARD', module: 'report-cards', entityId: card.id });
  return success(res, null, 'Rapor & nilai dikunci');
}));

/**
 * POST /report-cards/:id/approve  (Kepala Sekolah)
 */
router.post('/:id/approve', requirePermission('report-cards.update'), asyncHandler(async (req, res) => {
  const card = await prisma.reportCard.update({
    where: { id: req.params.id },
    data: { status: 'APPROVED', approvedAt: new Date(), approvedBy: req.user!.id, updatedBy: req.user!.id },
  });
  await writeAudit({ req, action: 'APPROVE_REPORT_CARD', module: 'report-cards', entityId: card.id });
  return success(res, card, 'Rapor disetujui');
}));

// ---- Export PDF ----
router.get('/:id/pdf', requirePermission('report-cards.read'), asyncHandler(async (req, res) => {
  const card = await prisma.reportCard.findFirst({
    where: { id: req.params.id, deletedAt: null },
    include: { student: true, class: true },
  });
  if (!card) throw ApiError.notFound('Rapor tidak ditemukan');

  const grades = await prisma.grade.findMany({
    where: { studentId: card.studentId, semesterId: card.semesterId, deletedAt: null },
    include: { subject: true },
  });
  const school = await prisma.schoolProfile.findFirst({ where: { deletedAt: null } });

  streamReportCardPdf(res, {
    schoolName: school?.name ?? 'RQ An Nahl',
    studentName: card.student.fullName,
    nis: card.student.nis,
    className: card.class?.name,
    semester: card.semesterId,
    average: card.averageScore,
    rank: card.rank,
    attitudeNote: card.attitudeNote,
    teacherNote: card.teacherNote,
    rows: grades.map((g) => ({ subject: g.subject.name, type: g.type, score: g.score })),
  });
}));

export default router;
