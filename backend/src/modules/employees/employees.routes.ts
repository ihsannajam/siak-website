import { Router } from 'express';
import { z } from 'zod';
import { createCrudRouter } from '../../common/crudRouter';
import { authenticate } from '../../middlewares/auth';
import { requirePermission } from '../../middlewares/rbac';
import { validate } from '../../middlewares/validate';
import { upload, uploadToSupabase, getPublicUrl } from '../../common/storage';
import { asyncHandler } from '../../common/asyncHandler';
import { success, created } from '../../common/apiResponse';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../common/ApiError';

const optionalString = z.string().trim().optional().nullable();

export const employeeSchema = z.object({
  nip: optionalString,
  nuptk: optionalString,
  nik: optionalString,
  fullName: z.string().min(1, 'Nama lengkap wajib diisi'),
  gender: z.enum(['LAKI_LAKI', 'PEREMPUAN']).optional().nullable(),
  birthPlace: optionalString,
  birthDate: z.coerce.date().optional().nullable(),
  address: optionalString,
  phone: optionalString,
  email: z.string().email().optional().nullable().or(z.literal('')),
  position: z.string().min(1, 'Jabatan wajib diisi'),
  employmentStatus: z.enum(['TETAP', 'KONTRAK', 'HONORER']).optional(),
  educationHistory: optionalString,
  certification: optionalString,
  bankName: optionalString,
  bankAccount: optionalString,
});

const salarySchema = z.object({
  name: z.string().min(1),
  type: z.enum(['TUNJANGAN', 'POTONGAN', 'GAJI_POKOK']),
  amount: z.coerce.number().nonnegative(),
});

// Base CRUD via factory
const router = createCrudRouter({
  permissionKey: 'employees',
  modelName: 'employee',
  searchFields: ['fullName', 'nip', 'nuptk', 'nik', 'position'],
  defaultSort: { fullName: 'asc' },
  include: { salaryComponents: { where: { deletedAt: null } } },
  createSchema: employeeSchema,
  updateSchema: employeeSchema.partial(),
});

// ---- Extra: document upload ----
router.post(
  '/:id/documents',
  authenticate,
  requirePermission('employees.update'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('File tidak ditemukan');
    const supabasePath = await uploadToSupabase(req.file, 'employees');
    const doc = await prisma.employeeDocument.create({
      data: {
        employeeId: req.params.id,
        docType: req.body.docType ?? 'LAINNYA',
        fileName: req.file.originalname,
        filePath: getPublicUrl(supabasePath),
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        createdBy: req.user!.id,
      },
    });
    return created(res, doc, 'Dokumen pegawai diunggah');
  }),
);

// ---- Extra: salary components ----
router.post(
  '/:id/salary-components',
  authenticate,
  requirePermission('employees.update'),
  validate(salarySchema),
  asyncHandler(async (req, res) => {
    const comp = await prisma.employeeSalaryComponent.create({
      data: { employeeId: req.params.id, ...req.body, createdBy: req.user!.id },
    });
    return created(res, comp, 'Komponen gaji ditambahkan');
  }),
);

router.get(
  '/:id/salary-components',
  authenticate,
  requirePermission('employees.read'),
  asyncHandler(async (req, res) => {
    const comps = await prisma.employeeSalaryComponent.findMany({
      where: { employeeId: req.params.id, deletedAt: null },
    });
    return success(res, comps);
  }),
);

export default router;
