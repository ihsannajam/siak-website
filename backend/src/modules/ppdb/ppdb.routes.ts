import { Router } from 'express';
import { z } from 'zod';
import { ppdbService } from './ppdb.service';
import { authenticate } from '../../middlewares/auth';
import { requirePermission } from '../../middlewares/rbac';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../common/asyncHandler';
import { success, created } from '../../common/apiResponse';
import { getPageParams } from '../../common/pagination';
import { writeAudit } from '../../common/audit';
import { upload, getPublicUrl } from '../../common/storage';
import { ApiError } from '../../common/ApiError';
import { prisma } from '../../config/prisma';

const optionalString = z.string().trim().optional().nullable();

const ppdbSchema = z.object({
  fullName: z.string().min(1),
  birthPlace: optionalString,
  birthDate: z.coerce.date().optional().nullable(),
  gender: z.enum(['LAKI_LAKI', 'PEREMPUAN']),
  address: optionalString,
  bloodType: optionalString,
  diseaseHistory: optionalString,
  allergies: optionalString,
  fatherName: optionalString,
  motherName: optionalString,
  guardianName: optionalString,
  guardianPhone: optionalString,
  notes: optionalString,
});

const router = Router();
router.use(authenticate);

router.get(
  '/',
  requirePermission('ppdb.read'),
  asyncHandler(async (req, res) => {
    const params = getPageParams(req);
    const { items, meta } = await ppdbService.list(params, req.query.status as string);
    return success(res, items, 'Berhasil', 200, meta);
  }),
);

router.get('/:id', requirePermission('ppdb.read'), asyncHandler(async (req, res) => {
  return success(res, await ppdbService.getById(req.params.id));
}));

router.get('/:id/logs', requirePermission('ppdb.read'), asyncHandler(async (req, res) => {
  return success(res, await ppdbService.logs(req.params.id));
}));

router.post('/', requirePermission('ppdb.create'), validate(ppdbSchema), asyncHandler(async (req, res) => {
  const reg = await ppdbService.create(req.body, req.user!.id);
  await writeAudit({ req, action: 'CREATE', module: 'ppdb', entityId: reg.id });
  return created(res, reg, 'Pendaftaran berhasil dibuat');
}));

router.put('/:id', requirePermission('ppdb.update'), validate(ppdbSchema.partial()), asyncHandler(async (req, res) => {
  return success(res, await ppdbService.update(req.params.id, req.body, req.user!.id), 'Pendaftaran diperbarui');
}));

router.delete('/:id', requirePermission('ppdb.delete'), asyncHandler(async (req, res) => {
  await ppdbService.remove(req.params.id, req.user!.id);
  return success(res, null, 'Pendaftaran dihapus');
}));

// ---- Document upload + verify ----
router.post('/:id/documents', requirePermission('ppdb.update'), upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('File tidak ditemukan');
  const doc = await prisma.ppdbDocument.create({
    data: {
      registrationId: req.params.id,
      docType: req.body.docType ?? 'PERSYARATAN',
      fileName: req.file.originalname,
      filePath: getPublicUrl(req.file.path),
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      createdBy: req.user!.id,
    },
  });
  return created(res, doc, 'Dokumen diunggah');
}));

router.post(
  '/:id/verify-document',
  requirePermission('ppdb.update'),
  validate(z.object({ documentId: z.string().uuid(), isVerified: z.boolean() })),
  asyncHandler(async (req, res) => {
    const result = await ppdbService.verifyDocument(req.body.documentId, req.body.isVerified, req.user!.id);
    await writeAudit({ req, action: 'VERIFY_DOCUMENT', module: 'ppdb', entityId: req.params.id });
    return success(res, result, 'Verifikasi dokumen diperbarui');
  }),
);

// ---- Selection schedule ----
router.post(
  '/:id/selection-schedule',
  requirePermission('ppdb.update'),
  validate(z.object({ testDate: z.coerce.date(), testTime: optionalString, location: optionalString })),
  asyncHandler(async (req, res) => {
    const sched = await prisma.ppdbSelectionSchedule.create({
      data: { registrationId: req.params.id, ...req.body, createdBy: req.user!.id },
    });
    return created(res, sched, 'Jadwal seleksi dibuat');
  }),
);

// ---- Scorecard ----
router.post(
  '/:id/scorecard',
  requirePermission('ppdb.update'),
  validate(
    z.object({
      writtenScore: z.coerce.number().optional().nullable(),
      interviewScore: z.coerce.number().optional().nullable(),
      behaviorScore: z.coerce.number().optional().nullable(),
      evaluatorNote: optionalString,
      recommendation: optionalString,
    }),
  ),
  asyncHandler(async (req, res) => {
    const card = await prisma.ppdbScorecard.create({
      data: { registrationId: req.params.id, ...req.body, evaluatorId: req.user!.id, createdBy: req.user!.id },
    });
    return created(res, card, 'Scorecard disimpan');
  }),
);

// ---- Selection result ----
router.post(
  '/:id/set-selection-result',
  requirePermission('ppdb.update'),
  validate(z.object({ status: z.string(), note: optionalString })),
  asyncHandler(async (req, res) => {
    const result = await ppdbService.setSelectionResult(req.params.id, req.body.status, req.body.note, req.user!.id);
    await writeAudit({ req, action: 'SET_SELECTION_RESULT', module: 'ppdb', entityId: req.params.id, detail: req.body.status });
    return success(res, result, 'Hasil seleksi diperbarui');
  }),
);

// ---- Payment (daftar ulang) ----
router.post(
  '/:id/payment',
  requirePermission('ppdb.update'),
  validate(z.object({ amount: z.coerce.number().nonnegative(), status: z.string().optional() })),
  asyncHandler(async (req, res) => {
    const pay = await prisma.ppdbPayment.create({
      data: {
        registrationId: req.params.id,
        amount: req.body.amount,
        status: (req.body.status as any) ?? 'MENUNGGU_VERIFIKASI',
        createdBy: req.user!.id,
      },
    });
    return created(res, pay, 'Pembayaran daftar ulang dicatat');
  }),
);

// ---- Sync accepted registrant to student master ----
router.post('/:id/sync-to-student', requirePermission('ppdb.update'), asyncHandler(async (req, res) => {
  const result = await ppdbService.syncToStudent(req.params.id, req.user!.id);
  await writeAudit({ req, action: 'SYNC_TO_STUDENT', module: 'ppdb', entityId: req.params.id, detail: `NIS ${result.nis}` });
  return created(res, result, 'Calon siswa berhasil disinkronkan ke data siswa');
}));

export default router;
