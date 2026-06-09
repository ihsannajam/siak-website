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

const router = Router();
router.use(authenticate);

const optionalString = z.string().trim().optional().nullable();

const scheduleSchema = z.object({
  name: z.string().min(1),
  academicYearId: z.string().uuid(),
  semesterId: z.string().uuid(),
});

const detailSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(1).max(7),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format jam HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format jam HH:MM'),
  subjectId: z.string().uuid().optional().nullable(),
  teacherId: z.string().uuid().optional().nullable(),
  classId: z.string().uuid().optional().nullable(),
  classroomId: z.string().uuid().optional().nullable(),
  activityType: optionalString,
});

/** Returns true when two [start,end) time ranges overlap on the same day. */
function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Business Rule #5: detect teacher / classroom / class clashes within the same
 * schedule + day + overlapping time window.
 */
async function detectConflicts(scheduleId: string, detail: z.infer<typeof detailSchema>, excludeId?: string) {
  const sameDay = await prisma.scheduleDetail.findMany({
    where: {
      scheduleId,
      dayOfWeek: detail.dayOfWeek,
      deletedAt: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
  const conflicts: string[] = [];
  for (const d of sameDay) {
    if (!overlaps(detail.startTime, detail.endTime, d.startTime, d.endTime)) continue;
    if (detail.teacherId && d.teacherId === detail.teacherId) conflicts.push(`Guru bentrok pada ${d.startTime}-${d.endTime}`);
    if (detail.classroomId && d.classroomId === detail.classroomId) conflicts.push(`Ruangan bentrok pada ${d.startTime}-${d.endTime}`);
    if (detail.classId && d.classId === detail.classId) conflicts.push(`Kelas bentrok pada ${d.startTime}-${d.endTime}`);
  }
  return conflicts;
}

// ---- List / detail ----
router.get('/', requirePermission('schedules.read'), asyncHandler(async (req, res) => {
  const params = getPageParams(req);
  const where = { deletedAt: null };
  const [items, total] = await Promise.all([
    prisma.schedule.findMany({ where, orderBy: { createdAt: 'desc' }, skip: params.skip, take: params.limit }),
    prisma.schedule.count({ where }),
  ]);
  return success(res, items, 'Berhasil', 200, buildMeta(total, params));
}));

router.get('/:id', requirePermission('schedules.read'), asyncHandler(async (req, res) => {
  const sch = await prisma.schedule.findFirst({
    where: { id: req.params.id, deletedAt: null },
    include: {
      details: {
        where: { deletedAt: null },
        include: { subject: true, class: true, classroom: true },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      },
    },
  });
  if (!sch) throw ApiError.notFound('Jadwal tidak ditemukan');
  return success(res, sch);
}));

// ---- Create / update / delete schedule ----
router.post('/', requirePermission('schedules.create'), validate(scheduleSchema), asyncHandler(async (req, res) => {
  const sch = await prisma.schedule.create({ data: { ...req.body, createdBy: req.user!.id } });
  await writeAudit({ req, action: 'CREATE', module: 'schedules', entityId: sch.id });
  return created(res, sch);
}));

router.put('/:id', requirePermission('schedules.update'), validate(scheduleSchema.partial()), asyncHandler(async (req, res) => {
  const sch = await prisma.schedule.update({ where: { id: req.params.id }, data: { ...req.body, updatedBy: req.user!.id } });
  return success(res, sch, 'Jadwal diperbarui');
}));

router.delete('/:id', requirePermission('schedules.delete'), asyncHandler(async (req, res) => {
  await prisma.schedule.update({ where: { id: req.params.id }, data: { deletedAt: new Date(), updatedBy: req.user!.id } });
  return success(res, null, 'Jadwal dihapus');
}));

// ---- Check conflict (preview) ----
router.post(
  '/:id/check-conflict',
  requirePermission('schedules.update'),
  validate(detailSchema),
  asyncHandler(async (req, res) => {
    const conflicts = await detectConflicts(req.params.id, req.body);
    return success(res, { hasConflict: conflicts.length > 0, conflicts }, conflicts.length ? 'Ada bentrok' : 'Tidak ada bentrok');
  }),
);

// ---- Add detail (rejects if conflict) ----
router.post(
  '/:id/details',
  requirePermission('schedules.update'),
  validate(detailSchema),
  asyncHandler(async (req, res) => {
    const conflicts = await detectConflicts(req.params.id, req.body);
    if (conflicts.length) throw ApiError.unprocessable('Jadwal bentrok', conflicts);
    const detail = await prisma.scheduleDetail.create({
      data: { scheduleId: req.params.id, ...req.body, createdBy: req.user!.id },
    });
    return created(res, detail, 'Slot jadwal ditambahkan');
  }),
);

router.delete('/details/:detailId', requirePermission('schedules.update'), asyncHandler(async (req, res) => {
  await prisma.scheduleDetail.update({ where: { id: req.params.detailId }, data: { deletedAt: new Date(), updatedBy: req.user!.id } });
  return success(res, null, 'Slot jadwal dihapus');
}));

// ---- Publish ----
router.post('/:id/publish', requirePermission('schedules.update'), asyncHandler(async (req, res) => {
  const sch = await prisma.schedule.update({
    where: { id: req.params.id },
    data: { status: 'PUBLISHED', publishedAt: new Date(), updatedBy: req.user!.id },
  });
  await writeAudit({ req, action: 'PUBLISH', module: 'schedules', entityId: sch.id });
  return success(res, sch, 'Jadwal dipublikasikan ke dashboard guru');
}));

export default router;
