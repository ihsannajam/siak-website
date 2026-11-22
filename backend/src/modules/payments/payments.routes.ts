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
import { getSignedFileUrl, upload, uploadPrivate } from '../../common/storage';
import { studentSummary } from '../../common/personSelect';

/** Lokasi bukti bayar tidak pernah dikirim ke browser. */
const toPaymentDto = <T extends { proofPath: string | null }>({ proofPath, ...payment }: T) => ({
  ...payment,
  hasProof: !!proofPath,
});

const router = Router();
router.use(authenticate);

const paymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  method: z.string().optional().nullable(),
});

router.get('/', requirePermission('payments.read'), asyncHandler(async (req, res) => {
  const params = getPageParams(req);
  const where: Record<string, unknown> = { deletedAt: null };
  if (req.query.status) where.status = req.query.status;
  const [items, total] = await Promise.all([
    prisma.payment.findMany({ where, include: { invoice: { include: { student: studentSummary } } }, orderBy: { createdAt: 'desc' }, skip: params.skip, take: params.limit }),
    prisma.payment.count({ where }),
  ]);
  return success(res, items.map(toPaymentDto), 'Berhasil', 200, buildMeta(total, params));
}));

router.get('/:id', requirePermission('payments.read'), asyncHandler(async (req, res) => {
  const item = await prisma.payment.findFirst({ where: { id: req.params.id, deletedAt: null }, include: { invoice: { include: { student: studentSummary } } } });
  if (!item) throw ApiError.notFound('Pembayaran tidak ditemukan');
  return success(res, toPaymentDto(item));
}));

// Link sementara (60 detik) untuk membuka bukti bayar.
router.get('/:id/proof-url', requirePermission('payments.read'), asyncHandler(async (req, res) => {
  const payment = await prisma.payment.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!payment?.proofPath) throw ApiError.notFound('Bukti bayar tidak ditemukan');
  const url = await getSignedFileUrl(payment.proofPath, 60);
  await writeAudit({ req, action: 'VIEW_PAYMENT_PROOF', module: 'payments', entityId: payment.id });
  res.setHeader('Cache-Control', 'no-store');
  return success(res, { url, expiresIn: 60 });
}));

// Create payment + upload proof (multipart: file optional, fields invoiceId/amount/method)
router.post('/', requirePermission('payments.create'), upload.single('file'), asyncHandler(async (req, res) => {
  const parsed = paymentSchema.parse(req.body);
  const invoice = await prisma.invoice.findFirst({ where: { id: parsed.invoiceId, deletedAt: null }, select: { id: true } });
  if (!invoice) throw ApiError.notFound('Tagihan tidak ditemukan');
  const proofPath = req.file ? await uploadPrivate(req.file, `payments/${invoice.id}`) : null;
  const payment = await prisma.payment.create({
    data: {
      ...parsed,
      proofPath,
      status: 'MENUNGGU_VERIFIKASI',
      paidAt: new Date(),
      createdBy: req.user!.id,
    },
  });
  await writeAudit({ req, action: 'CREATE', module: 'payments', entityId: payment.id });
  return created(res, toPaymentDto(payment), 'Pembayaran dicatat, menunggu verifikasi');
}));

/**
 * POST /payments/:id/verify
 * Verifies the payment, marks the invoice LUNAS, and records a cash inflow —
 * integrating Keuangan (Business Rules section).
 */
router.post(
  '/:id/verify',
  requirePermission('payments.update'),
  validate(z.object({ approved: z.boolean() })),
  asyncHandler(async (req, res) => {
    const payment = await prisma.payment.findFirst({ where: { id: req.params.id, deletedAt: null }, include: { invoice: true } });
    if (!payment) throw ApiError.notFound('Pembayaran tidak ditemukan');

    const approved = req.body.approved as boolean;

    const result = await prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: approved ? 'LUNAS' : 'DITOLAK',
          verifiedAt: new Date(),
          verifiedBy: req.user!.id,
          updatedBy: req.user!.id,
        },
      });

      if (approved) {
        await tx.invoice.update({ where: { id: payment.invoiceId }, data: { status: 'LUNAS', updatedBy: req.user!.id } });
        await tx.cashTransaction.create({
          data: {
            code: `KAS-${Date.now()}`,
            type: 'MASUK',
            category: 'PEMBAYARAN_SISWA',
            description: `Pembayaran invoice ${payment.invoice.invoiceNumber}`,
            amount: payment.amount,
            date: new Date(),
            createdBy: req.user!.id,
          },
        });
      }
      return updatedPayment;
    });

    await writeAudit({ req, action: 'VERIFY_PAYMENT', module: 'payments', entityId: payment.id, detail: approved ? 'LUNAS' : 'DITOLAK' });
    return success(res, toPaymentDto(result), approved ? 'Pembayaran terverifikasi' : 'Pembayaran ditolak');
  }),
);

export default router;
