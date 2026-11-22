import { z } from 'zod';

const optionalString = z.string().trim().optional().nullable();
const optionalDate = z.coerce.date().optional().nullable();
const optionalCount = z.coerce.number().int().min(0).optional().nullable();
const optionalYear = z.coerce.number().int().min(1900).max(2100).optional().nullable();
const optionalNik = z.string().trim().regex(/^\d{16}$/, 'NIK harus 16 digit angka').optional().nullable();
const optionalEmail = z.string().trim().email('Format email tidak valid').optional().nullable();
const optionalEnum = <T extends [string, ...string[]]>(values: T) => z.enum(values).optional().nullable();

const LIFE_STATUS = ['HIDUP', 'MENINGGAL'] as const;

const parentFields = <P extends 'father' | 'mother'>(prefix: P) =>
  ({
    [`${prefix}Nik`]: optionalNik,
    [`${prefix}BirthPlace`]: optionalString,
    [`${prefix}BirthDate`]: optionalDate,
    [`${prefix}Religion`]: optionalString,
    [`${prefix}Nationality`]: optionalString,
    [`${prefix}Education`]: optionalString,
    [`${prefix}Income`]: optionalCount,
    [`${prefix}Email`]: optionalEmail,
    [`${prefix}Address`]: optionalString,
    [`${prefix}LifeStatus`]: optionalEnum([...LIFE_STATUS]),
    [`${prefix}DeathYear`]: optionalYear,
  }) as Record<string, z.ZodTypeAny>;

export const familySchema = z.object({
  fatherName: optionalString,
  fatherJob: optionalString,
  fatherPhone: optionalString,
  motherName: optionalString,
  motherJob: optionalString,
  motherPhone: optionalString,
  guardianName: optionalString,
  guardianRelation: optionalString,
  guardianPhone: optionalString,
  guardianAddress: optionalString,
  ...parentFields('father'),
  ...parentFields('mother'),
  guardianNik: optionalNik,
  guardianBirthPlace: optionalString,
  guardianBirthDate: optionalDate,
  guardianReligion: optionalString,
  guardianEducation: optionalString,
  guardianJob: optionalString,
  guardianIncome: optionalCount,
  guardianEmail: optionalEmail,
});

export const healthSchema = z.object({
  bloodType: optionalString,
  height: z.coerce.number().min(0).optional().nullable(),
  weight: z.coerce.number().min(0).optional().nullable(),
  diseaseHistory: optionalString,
  foodAllergies: optionalString,
  drugAllergies: optionalString,
  physicalCondition: optionalString,
  specialNeeds: optionalString,
  notes: optionalString,
});

export const educationHistorySchema = z.object({
  id: z.string().uuid().optional(),
  level: z.enum(['PAUD', 'TK', 'SD', 'SMP', 'SMA']),
  schoolName: z.string().trim().min(1, 'Nama sekolah wajib diisi'),
  npsn: optionalString,
  schoolStatus: optionalEnum(['NEGERI', 'SWASTA']),
  schoolAddress: optionalString,
  entryYear: optionalYear,
  exitYear: optionalYear,
  lastClass: optionalString,
  educationStatus: optionalEnum(['LULUS', 'PINDAH', 'BELUM_LULUS']),
  diplomaNumber: optionalString,
  diplomaDate: optionalDate,
  skhunNumber: optionalString,
  skhunDate: optionalDate,
  studyDuration: optionalString,
  notes: optionalString,
});

export const createStudentSchema = z.object({
  nis: optionalString,
  nisn: optionalString,
  nik: optionalNik,
  fullName: z.string().trim().min(1, 'Nama lengkap wajib diisi'),
  nickname: optionalString,
  birthPlace: optionalString,
  birthDate: optionalDate,
  gender: z.enum(['LAKI_LAKI', 'PEREMPUAN']),
  religion: optionalString,
  nationality: optionalString,
  childOrder: optionalCount,
  siblingsCount: optionalCount,
  stepSiblingsCount: optionalCount,
  adoptedSiblingsCount: optionalCount,
  childStatus: optionalEnum(['LENGKAP', 'YATIM', 'PIATU', 'YATIM_PIATU']),
  dailyLanguage: optionalString,
  address: optionalString,
  village: optionalString,
  district: optionalString,
  city: optionalString,
  province: optionalString,
  postalCode: optionalString,
  phone: optionalString,
  email: optionalEmail,
  livingWith: optionalEnum(['AYAH', 'IBU', 'ORANG_TUA', 'WALI', 'LAINNYA']),
  distanceToSchoolKm: z.coerce.number().min(0).optional().nullable(),
  registrationNumber: optionalString,
  registrationDate: optionalDate,
  entryAcademicYearId: z.string().uuid().optional().nullable(),
  educationProgram: optionalString,
  admissionType: optionalEnum(['SISWA_BARU', 'PINDAHAN']),
  admissionClassId: z.string().uuid().optional().nullable(),
  startStudyDate: optionalDate,
  status: z.enum(['AKTIF', 'LULUS', 'PINDAH', 'DROP_OUT', 'NONAKTIF', 'MENGUNDURKAN_DIRI']).optional(),
  family: familySchema.optional(),
  health: healthSchema.optional(),
  educationHistories: z.array(educationHistorySchema).optional(),
});

export const updateStudentSchema = createStudentSchema.partial();

export const bulkPromoteSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1),
  targetClassId: z.string().uuid(),
});

export const graduateSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1),
});
