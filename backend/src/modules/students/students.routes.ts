import { Router } from 'express';
import multer from 'multer';
import { studentsController } from './students.controller';
import { authenticate } from '../../middlewares/auth';
import { requirePermission } from '../../middlewares/rbac';
import { validate } from '../../middlewares/validate';
import { upload } from '../../common/storage';
import { asyncHandler } from '../../common/asyncHandler';
import { success, created } from '../../common/apiResponse';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../common/ApiError';
import { getPublicUrl } from '../../common/storage';
import {
  createStudentSchema,
  updateStudentSchema,
  bulkPromoteSchema,
  graduateSchema,
} from './students.validation';

const router = Router();
const memoryUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(authenticate);

// Special endpoints (declare before /:id)
router.get('/export', requirePermission('students.read'), studentsController.export);
router.get('/alumni', requirePermission('students.read'), studentsController.alumni);
router.post(
  '/import',
  requirePermission('students.create'),
  memoryUpload.single('file'),
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
    const doc = await prisma.studentDocument.create({
      data: {
        studentId: req.params.id,
        docType: req.body.docType ?? 'LAINNYA',
        fileName: req.file.originalname,
        filePath: getPublicUrl(req.file.path),
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        createdBy: req.user!.id,
      },
    });
    return created(res, doc, 'Dokumen berhasil diunggah');
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
    return success(res, docs);
  }),
);

// Standard CRUD
router.get('/', requirePermission('students.read'), studentsController.list);
router.get('/:id', requirePermission('students.read'), studentsController.detail);
router.post('/', requirePermission('students.create'), validate(createStudentSchema), studentsController.create);
router.put('/:id', requirePermission('students.update'), validate(updateStudentSchema), studentsController.update);
router.delete('/:id', requirePermission('students.delete'), studentsController.remove);

export default router;
