import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { requirePermission } from '../../middlewares/rbac';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../common/asyncHandler';
import { success, created } from '../../common/apiResponse';
import { getPageParams, buildMeta } from '../../common/pagination';
import { writeAudit } from '../../common/audit';
import { ApiError } from '../../common/ApiError';
import { prisma } from '../../config/prisma';
import { gradeSchema } from '../masterData/schemas';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('grades.read'), asyncHandler(async (req, res) => {
  const params = getPageParams(req);
  const where: Record<string, unknown> = { deletedAt: null };
  if (req.query.studentId) where.studentId = req.query.studentId;
  if (req.query.subjectId) where.subjectId = req.query.subjectId;
  if (req.query.semesterId) where.semesterId = req.query.semesterId;
  const [items, total] = await Promise.all([
    prisma.grade.findMany({ where, include: { student: true, subject: true }, orderBy: { createdAt: 'desc' }, skip: params.skip, take: params.limit }),
    prisma.grade.count({ where }),
  ]);
  return success(res, items, 'Berhasil', 200, buildMeta(total, params));
}));

router.get('/:id', requirePermission('grades.read'), asyncHandler(async (req, res) => {
  const item = await prisma.grade.findFirst({ where: { id: req.params.id, deletedAt: null }, include: { student: true, subject: true } });
  if (!item) throw ApiError.notFound('Nilai tidak ditemukan');
  return success(res, item);
}));

router.post('/', requirePermission('grades.create'), validate(gradeSchema), asyncHandler(async (req, res) => {
  const item = await prisma.grade.create({ data: { ...req.body, teacherId: req.user!.id, createdBy: req.user!.id } });
  await writeAudit({ req, action: 'CREATE', module: 'grades', entityId: item.id });
  return created(res, item, 'Nilai disimpan');
}));

router.put('/:id', requirePermission('grades.update'), validate(gradeSchema.partial()), asyncHandler(async (req, res) => {
  const existing = await prisma.grade.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Nilai tidak ditemukan');
  // Business Rule #8: a locked grade cannot be modified.
  if (existing.isLocked) throw ApiError.unprocessable('Nilai sudah dikunci dan tidak dapat diubah');
  const item = await prisma.grade.update({ where: { id: req.params.id }, data: { ...req.body, updatedBy: req.user!.id } });
  return success(res, item, 'Nilai diperbarui');
}));

router.delete('/:id', requirePermission('grades.delete'), asyncHandler(async (req, res) => {
  const existing = await prisma.grade.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Nilai tidak ditemukan');
  if (existing.isLocked) throw ApiError.unprocessable('Nilai sudah dikunci dan tidak dapat dihapus');
  await prisma.grade.update({ where: { id: req.params.id }, data: { deletedAt: new Date(), updatedBy: req.user!.id } });
  return success(res, null, 'Nilai dihapus');
}));

export default router;
