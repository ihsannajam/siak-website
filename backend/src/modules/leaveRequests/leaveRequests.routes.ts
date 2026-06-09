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
import { leaveRequestSchema } from '../masterData/schemas';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('leave-requests.read'), asyncHandler(async (req, res) => {
  const params = getPageParams(req);
  const where: Record<string, unknown> = { deletedAt: null };
  if (req.query.status) where.status = req.query.status;
  if (req.query.employeeId) where.employeeId = req.query.employeeId;
  const [items, total] = await Promise.all([
    prisma.leaveRequest.findMany({ where, include: { employee: true }, orderBy: { createdAt: 'desc' }, skip: params.skip, take: params.limit }),
    prisma.leaveRequest.count({ where }),
  ]);
  return success(res, items, 'Berhasil', 200, buildMeta(total, params));
}));

router.get('/:id', requirePermission('leave-requests.read'), asyncHandler(async (req, res) => {
  const item = await prisma.leaveRequest.findFirst({ where: { id: req.params.id, deletedAt: null }, include: { employee: true } });
  if (!item) throw ApiError.notFound('Pengajuan tidak ditemukan');
  return success(res, item);
}));

router.post('/', requirePermission('leave-requests.create'), validate(leaveRequestSchema), asyncHandler(async (req, res) => {
  const item = await prisma.leaveRequest.create({ data: { ...req.body, status: 'DIAJUKAN', createdBy: req.user!.id } });
  await writeAudit({ req, action: 'CREATE', module: 'leave-requests', entityId: item.id });
  return created(res, item, 'Pengajuan izin/cuti dibuat');
}));

router.put('/:id', requirePermission('leave-requests.update'), validate(leaveRequestSchema.partial()), asyncHandler(async (req, res) => {
  const item = await prisma.leaveRequest.update({ where: { id: req.params.id }, data: { ...req.body, updatedBy: req.user!.id } });
  return success(res, item, 'Pengajuan diperbarui');
}));

router.delete('/:id', requirePermission('leave-requests.delete'), asyncHandler(async (req, res) => {
  await prisma.leaveRequest.update({ where: { id: req.params.id }, data: { deletedAt: new Date(), updatedBy: req.user!.id } });
  return success(res, null, 'Pengajuan dihapus');
}));

// Approve / reject
router.post(
  '/:id/decision',
  requirePermission('leave-requests.update'),
  validate(z.object({ status: z.enum(['DISETUJUI', 'DITOLAK']) })),
  asyncHandler(async (req, res) => {
    const item = await prisma.leaveRequest.update({
      where: { id: req.params.id },
      data: { status: req.body.status, approvedBy: req.user!.id, approvedAt: new Date(), updatedBy: req.user!.id },
    });
    await writeAudit({ req, action: 'LEAVE_DECISION', module: 'leave-requests', entityId: item.id, detail: req.body.status });
    return success(res, item, `Pengajuan ${req.body.status.toLowerCase()}`);
  }),
);

export default router;
