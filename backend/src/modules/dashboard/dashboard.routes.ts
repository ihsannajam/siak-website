import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { requirePermission } from '../../middlewares/rbac';
import { asyncHandler } from '../../common/asyncHandler';
import { success } from '../../common/apiResponse';
import { prisma } from '../../config/prisma';

const router = Router();
router.use(authenticate);

async function buildSummary() {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const [
    activeStudents,
    newPpdb,
    acceptedPpdb,
    totalEmployees,
    studentPresentToday,
    employeePresentToday,
    pendingPayments,
    reportCardsPending,
    reportCardsApproved,
    totalAssets,
    brokenAssets,
  ] = await Promise.all([
    prisma.student.count({ where: { deletedAt: null, status: 'AKTIF' } }),
    prisma.ppdbRegistration.count({ where: { deletedAt: null } }),
    prisma.ppdbRegistration.count({ where: { deletedAt: null, status: 'DITERIMA' } }),
    prisma.employee.count({ where: { deletedAt: null } }),
    prisma.attendanceStudent.count({ where: { deletedAt: null, status: 'HADIR', date: { gte: startOfDay } } }),
    prisma.attendanceEmployee.count({ where: { deletedAt: null, status: 'HADIR', date: { gte: startOfDay } } }),
    prisma.payment.count({ where: { deletedAt: null, status: 'MENUNGGU_VERIFIKASI' } }),
    prisma.reportCard.count({ where: { deletedAt: null, status: { in: ['DRAFT', 'SUBMITTED'] } } }),
    prisma.reportCard.count({ where: { deletedAt: null, status: 'APPROVED' } }),
    prisma.asset.count({ where: { deletedAt: null } }),
    prisma.asset.count({ where: { deletedAt: null, condition: { in: ['RUSAK_RINGAN', 'RUSAK_BERAT'] } } }),
  ]);

  // finance aggregates
  const [cashIn, cashOut, paidInvoices, unpaidInvoices] = await Promise.all([
    prisma.cashTransaction.aggregate({ _sum: { amount: true }, where: { deletedAt: null, type: 'MASUK' } }),
    prisma.cashTransaction.aggregate({ _sum: { amount: true }, where: { deletedAt: null, type: 'KELUAR' } }),
    prisma.invoice.aggregate({ _sum: { amount: true }, where: { deletedAt: null, status: 'LUNAS' } }),
    prisma.invoice.aggregate({ _sum: { amount: true }, where: { deletedAt: null, status: { in: ['BELUM_BAYAR', 'MENUNGGU_VERIFIKASI'] } } }),
  ]);

  const recentActivities = await prisma.auditLog.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const tahfidzByQuality = await prisma.tahfidzRecord.groupBy({
    by: ['quality'],
    where: { deletedAt: null },
    _count: { _all: true },
  });

  return {
    students: { active: activeStudents, presentToday: studentPresentToday },
    ppdb: { total: newPpdb, accepted: acceptedPpdb },
    employees: { total: totalEmployees, presentToday: employeePresentToday },
    grades: { reportCardsPending, reportCardsApproved },
    finance: {
      cashIn: Number(cashIn._sum.amount ?? 0),
      cashOut: Number(cashOut._sum.amount ?? 0),
      balance: Number(cashIn._sum.amount ?? 0) - Number(cashOut._sum.amount ?? 0),
      paidInvoices: Number(paidInvoices._sum.amount ?? 0),
      outstanding: Number(unpaidInvoices._sum.amount ?? 0),
      pendingPayments,
    },
    assets: { total: totalAssets, broken: brokenAssets },
    tahfidz: tahfidzByQuality.map((t) => ({ quality: t.quality, count: t._count._all })),
    recentActivities,
  };
}

/**
 * @openapi
 * /dashboard/headmaster:
 *   get:
 *     tags: [Dashboard]
 *     summary: Dashboard monitoring Kepala Sekolah
 *     security: [{ bearerAuth: [] }]
 */
router.get('/headmaster', requirePermission('dashboard.read'), asyncHandler(async (_req, res) => {
  return success(res, await buildSummary(), 'Dashboard Kepala Sekolah');
}));

/**
 * @openapi
 * /dashboard/foundation:
 *   get:
 *     tags: [Dashboard]
 *     summary: Dashboard monitoring Yayasan
 *     security: [{ bearerAuth: [] }]
 */
router.get('/foundation', requirePermission('dashboard.read'), asyncHandler(async (_req, res) => {
  return success(res, await buildSummary(), 'Dashboard Yayasan');
}));

// Generic summary for any logged-in role
router.get('/summary', requirePermission('dashboard.read'), asyncHandler(async (_req, res) => {
  return success(res, await buildSummary(), 'Ringkasan dashboard');
}));

export default router;
