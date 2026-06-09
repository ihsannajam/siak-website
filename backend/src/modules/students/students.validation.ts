import { z } from 'zod';

const optionalString = z.string().trim().optional().nullable();

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
});

export const healthSchema = z.object({
  bloodType: optionalString,
  height: z.coerce.number().optional().nullable(),
  weight: z.coerce.number().optional().nullable(),
  diseaseHistory: optionalString,
  allergies: optionalString,
  notes: optionalString,
});

export const createStudentSchema = z.object({
  nis: optionalString,
  nisn: optionalString,
  fullName: z.string().min(1, 'Nama lengkap wajib diisi'),
  birthPlace: optionalString,
  birthDate: z.coerce.date().optional().nullable(),
  gender: z.enum(['LAKI_LAKI', 'PEREMPUAN']),
  address: optionalString,
  phone: optionalString,
  status: z.enum(['AKTIF', 'LULUS', 'PINDAH', 'DROP_OUT']).optional(),
  family: familySchema.optional(),
  health: healthSchema.optional(),
});

export const updateStudentSchema = createStudentSchema.partial();

export const bulkPromoteSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1),
  targetClassId: z.string().uuid(),
});

export const graduateSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1),
});
