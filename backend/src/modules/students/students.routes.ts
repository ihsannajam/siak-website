import { Router } from 'express';
import { studentsController } from './students.controller';
import { ALLOWED_DOC_TYPES, SENSITIVE_DOC_TYPES, toDocumentDto } from './students.service';
import { writeAudit } from '../../common/audit';
import { authenticate } from '../../middlewares/auth';
import { requirePermission } from '../../middlewares/rbac';
import { validate } from '../../middlewares/validate';
import { getSignedFileUrl, upload, uploadPrivate } from '../../common/storage';
import { asyncHandler } from '../../common/asyncHandler';
import { success, created } from '../../common/apiResponse';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../common/ApiError';
import {
  createStudentSchema,
  updateStudentSchema,
  bulkPromoteSchema,
  graduateSchema,
} from './students.validation';

const router = Router();

router.use(authenticate);

// Special endpoints (declare before /:id)
router.get('/export', requirePermission('students.read'), studentsController.export);
router.get('/filter-options', requirePermission('students.read'), studentsController.filterOptions);
router.get('/alumni', requirePermission('students.read'), studentsController.alumni);
router.post(
  '/import',
  requirePermission('students.create'),
  upload.single('file'),
  studentsController.import,
);
router.post(
  '/bulk-promote',
  requirePermission('students.update'),
  validate(bulkPromoteSchema),
  studentsController.bulkPromote,
);
router.post(
  '/graduate',
  requirePermission('students.update'),
  validate(graduateSchema),
  studentsController.graduate,
);

// Document upload for a student (field: "file", body: docType)
router.post(
  '/:id/documents',
  requirePermission('students.update'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('File tidak ditemukan');
    const docType = req.body.docType ?? 'LAINNYA';
    if (!ALLOWED_DOC_TYPES.has(docType)) throw ApiError.badRequest('Jenis dokumen tidak valid');
    const student = await prisma.student.findFirst({
      where: { id: req.params.id, deletedAt: null },
      select: { id: true },
    });
    if (!student) throw ApiError.notFound('Siswa tidak ditemukan');
    const filePath = await uploadPrivate(req.file, `students/${student.id}`);
    const doc = await prisma.studentDocument.create({
      data: {
        studentId: req.params.id,
        docType,
        fileName: req.file.originalname,
        filePath,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        createdBy: req.user!.id,
      },
    });
    if (doc.docType === 'PAS_FOTO' && req.file.mimetype.startsWith('image/')) {
      await prisma.student.update({
        where: { id: req.params.id },
        data: { photoPath: doc.filePath, updatedBy: req.user!.id },
      });
    }
    await writeAudit({ req, action: 'UPLOAD_DOCUMENT', module: 'students', entityId: student.id, detail: doc.docType });
    return created(res, toDocumentDto(doc), 'Dokumen berhasil diunggah');
  }),
);

router.get(
  '/:id/documents',
  requirePermission('students.read'),
  asyncHandler(async (req, res) => {
    const docs = await prisma.studentDocument.findMany({
      where: { studentId: req.params.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    const canViewSensitive = req.user!.permissions.includes('students.update');
    const visible = canViewSensitive ? docs : docs.filter((d) => !SENSITIVE_DOC_TYPES.has(d.docType));
    return success(res, visible.map(toDocumentDto));
  }),
);

// Link sementara (60 detik) untuk membuka satu dokumen.
router.get(
  '/:id/documents/:docId/url',
  requirePermission('students.read'),
  asyncHandler(async (req, res) => {
    const doc = await prisma.studentDocument.findFirst({
      where: {
        id: req.params.docId,
        studentId: req.params.id,
        deletedAt: null,
        student: { deletedAt: null },
      },
    });
    if (!doc) throw ApiError.notFound('Dokumen tidak ditemukan');
    if (SENSITIVE_DOC_TYPES.has(doc.docType) && !req.user!.permissions.includes('students.update')) {
      throw ApiError.forbidden('Anda tidak memiliki izin membuka dokumen ini');
    }
    const url = await getSignedFileUrl(doc.filePath, 60);
    await writeAudit({ req, action: 'VIEW_DOCUMENT', module: 'students', entityId: doc.studentId, detail: doc.docType });
    res.setHeader('Cache-Control', 'no-store');
    return success(res, { url, expiresIn: 60 });
  }),
);

// Standard CRUD
router.get('/', requirePermission('students.read'), studentsController.list);
router.get('/:id', requirePermission('students.read'), studentsController.detail);
router.post('/', requirePermission('students.create'), validate(createStudentSchema), studentsController.create);
router.put('/:id', requirePermission('students.update'), validate(updateStudentSchema), studentsController.update);
router.delete('/:id', requirePermission('students.delete'), studentsController.remove);

export default router;
