import { Request, Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../../common/ApiError';
import { success } from '../../common/apiResponse';
import { asyncHandler } from '../../common/asyncHandler';
import { writeAudit } from '../../common/audit';
import { getSignedFileUrl, upload, uploadPrivate } from '../../common/storage';
import { prisma } from '../../config/prisma';
import { authenticate } from '../../middlewares/auth';
import { requirePermission } from '../../middlewares/rbac';
import { validate } from '../../middlewares/validate';

const blankToNull = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? null : value;
const text = z.preprocess(blankToNull, z.string().trim().max(500).nullable().optional());
const longText = z.preprocess(blankToNull, z.string().trim().max(5000).nullable().optional());
const email = z.preprocess(blankToNull, z.string().trim().email('Format email tidak valid').nullable().optional());
const date = z.preprocess(blankToNull, z.coerce.date().nullable().optional());
const year = z.preprocess(blankToNull, z.coerce.number().int().min(1900).max(2100).nullable().optional());

/** Hanya http(s), supaya tautan seperti javascript: tidak bisa tersimpan. */
const link = z.preprocess((value) => {
  const clean = blankToNull(value);
  if (typeof clean !== 'string') return clean;
  const trimmed = clean.trim();
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}, z.string().url('Format tautan tidak valid').max(1000)
  .refine((value) => /^https?:\/\//i.test(value), 'Tautan harus http atau https')
  .nullable().optional());

export const schoolProfileSchema = z.object({
  name: z.string().trim().min(1, 'Nama sekolah wajib diisi').max(200),
  educationLevel: text, institutionType: text,
  schoolStatus: z.preprocess(blankToNull, z.enum(['NEGERI', 'SWASTA']).nullable().optional()),
  npsn: text, foundedYear: year, accreditation: text, accreditationYear: year,

  foundationName: text, establishmentDecreeNumber: text, establishmentDecreeDate: date,
  operationalPermitNumber: text, operationalPermitDate: date, accreditationDecreeNumber: text, npwp: text,

  address: longText, rtRw: text, village: text, district: text, city: text, province: text, postalCode: text,
  phone: text, whatsapp: text, email, website: link, googleMapsUrl: link,

  headmaster: text, headmasterNipNik: text, headmasterBirthPlace: text, headmasterBirthDate: date,
  headmasterEducation: text, headmasterPhone: text, headmasterEmail: email, headmasterStartDate: date,

  foundationChairman: text, foundationAddress: longText, foundationPhone: text, foundationEmail: email,
  foundationDeedNumber: text, foundationSkNumber: text,

  tagline: text, vision: longText, mission: longText, goals: longText,

  operatingHours: text, effectiveDays: text, entryTime: text, educationPrograms: longText,

  facebookUrl: link, instagramUrl: link, youtubeUrl: link, tiktokUrl: link, whatsappCenterUrl: link,
});

const PERSONAL_FIELDS = [
  'headmasterNipNik', 'headmasterBirthPlace', 'headmasterBirthDate', 'headmasterPhone', 'headmasterEmail',
] as const;

const IMAGE_FIELDS = {
  logo: 'logoPath',
  'foundation-logo': 'foundationLogoPath',
  'building-photo': 'buildingPhotoPath',
} as const;
type ImageKind = keyof typeof IMAGE_FIELDS;
const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const findProfile = () =>
  prisma.schoolProfile.findFirst({ where: { deletedAt: null }, orderBy: { createdAt: 'asc' } });

async function signedImage(filePath?: string | null) {
  if (!filePath) return null;
  try {
    return await getSignedFileUrl(filePath, 600);
  } catch {
    return null;
  }
}

/** Angka dan status ini dihitung dari menu lain agar tidak perlu diketik dua kali. */
async function getLiveStats() {
  const activeYear = await prisma.academicYear.findFirst({
    where: { isActive: true, deletedAt: null },
    select: { id: true, name: true },
  });
  const notDeleted = { deletedAt: null };
  const teacher = { ...notDeleted, position: { contains: 'guru', mode: 'insensitive' as const } };
  const [semester, curriculums, classrooms, assets, classes, students, teachers, employees] = await Promise.all([
    prisma.semester.findFirst({
      where: { isActive: true, deletedAt: null, ...(activeYear ? { academicYearId: activeYear.id } : {}) },
      select: { type: true },
    }),
    prisma.curriculum.findMany({ where: { isActive: true, deletedAt: null }, select: { name: true }, orderBy: { name: 'asc' } }),
    prisma.classroom.count({ where: notDeleted }),
    prisma.asset.count({ where: notDeleted }),
    activeYear ? prisma.class.count({ where: { deletedAt: null, academicYearId: activeYear.id } }) : 0,
    prisma.student.count({ where: { deletedAt: null, status: 'AKTIF' } }),
    prisma.employee.count({ where: teacher }),
    prisma.employee.count({ where: notDeleted }),
  ]);
  return {
    activeAcademicYear: activeYear?.name ?? null,
    activeSemester: semester?.type ?? null,
    curriculums: curriculums.map((c) => c.name),
    classrooms,
    assets,
    classes,
    activeStudents: students,
    teachers,
    staff: employees - teachers,
  };
}

async function presentProfile(req: Request) {
  const profile = await findProfile();
  const [stats, logo, foundationLogo, buildingPhoto] = await Promise.all([
    getLiveStats(),
    signedImage(profile?.logoPath),
    signedImage(profile?.foundationLogoPath),
    signedImage(profile?.buildingPhotoPath),
  ]);
  let visible: Record<string, unknown> | null = null;
  if (profile) {
    const { logoPath: _logo, foundationLogoPath: _foundation, buildingPhotoPath: _building, ...rest } = profile;
    visible = { ...rest };
    const canSeePersonal = req.user?.permissions?.includes('school-profile.update');
    if (!canSeePersonal) for (const field of PERSONAL_FIELDS) delete visible[field];
  }
  return { profile: visible, images: { logo, foundationLogo, buildingPhoto }, stats };
}

const router = Router();
router.use(authenticate);

router.get(
  '/',
  requirePermission('school-profile.read'),
  asyncHandler(async (req, res) => success(res, await presentProfile(req))),
);

router.put(
  '/',
  requirePermission('school-profile.update'),
  validate(schoolProfileSchema),
  asyncHandler(async (req, res) => {
    const existing = await findProfile();
    const saved = existing
      ? await prisma.schoolProfile.update({ where: { id: existing.id }, data: { ...req.body, updatedBy: req.user!.id } })
      : await prisma.schoolProfile.create({ data: { ...req.body, createdBy: req.user!.id } });
    await writeAudit({ req, action: existing ? 'UPDATE' : 'CREATE', module: 'school-profile', entityId: saved.id });
    return success(res, await presentProfile(req), 'Identitas sekolah disimpan');
  }),
);

router.post(
  '/images/:kind',
  requirePermission('school-profile.update'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const field = IMAGE_FIELDS[req.params.kind as ImageKind];
    if (!field) throw ApiError.badRequest('Jenis gambar tidak valid');
    if (!req.file) throw ApiError.badRequest('File tidak ditemukan');
    if (!IMAGE_MIME.has(req.file.mimetype)) throw ApiError.badRequest('Gambar harus JPG, PNG, atau WEBP');
    const existing = await findProfile();
    if (!existing) throw ApiError.badRequest('Simpan identitas sekolah terlebih dahulu');
    const filePath = await uploadPrivate(req.file, 'school-profile');
    await prisma.schoolProfile.update({ where: { id: existing.id }, data: { [field]: filePath, updatedBy: req.user!.id } });
    await writeAudit({ req, action: 'UPLOAD_DOCUMENT', module: 'school-profile', entityId: existing.id, detail: req.params.kind });
    return success(res, await presentProfile(req), 'Gambar diunggah');
  }),
);

export default router;
