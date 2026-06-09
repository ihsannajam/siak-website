import { z } from 'zod';

// Reusable helpers
const optionalString = z.string().trim().optional().nullable();
const dateString = z.coerce.date();
const optionalDate = z.coerce.date().optional().nullable();

// ---- School profile ----
export const schoolProfileSchema = z.object({
  name: z.string().min(1, 'Nama sekolah wajib diisi'),
  npsn: optionalString,
  address: optionalString,
  phone: optionalString,
  email: z.string().email().optional().nullable().or(z.literal('')),
  website: optionalString,
  logoPath: optionalString,
  headmaster: optionalString,
});

// ---- Academic year ----
export const academicYearSchema = z.object({
  name: z.string().min(4, 'Format tahun ajaran mis. 2025/2026'),
  startDate: dateString,
  endDate: dateString,
  isActive: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

// ---- Semester ----
export const semesterSchema = z.object({
  academicYearId: z.string().uuid(),
  type: z.enum(['GANJIL', 'GENAP']),
  isActive: z.boolean().optional(),
});

// ---- Academic calendar ----
export const academicCalendarSchema = z.object({
  title: z.string().min(1),
  description: optionalString,
  startDate: dateString,
  endDate: dateString,
  category: z.enum(['LIBUR_NASIONAL', 'LIBUR_SEKOLAH', 'AGENDA']),
  isHoliday: z.boolean().optional(),
});

// ---- Subject ----
export const subjectSchema = z.object({
  code: z.string().min(1, 'Kode wajib diisi'),
  name: z.string().min(1, 'Nama wajib diisi'),
  category: optionalString,
  description: optionalString,
});

// ---- Curriculum ----
export const curriculumSchema = z.object({
  name: z.string().min(1),
  code: optionalString,
  description: optionalString,
  isActive: z.boolean().optional(),
});

// ---- Class (rombel) ----
export const classSchema = z.object({
  name: z.string().min(1),
  gradeLevel: z.string().min(1),
  academicYearId: z.string().uuid(),
  homeroomTeacherId: z.string().uuid().optional().nullable(),
  capacity: z.coerce.number().int().positive().optional().nullable(),
});

// ---- Classroom ----
export const classroomSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  capacity: z.coerce.number().int().positive().optional().nullable(),
  location: optionalString,
});

// ---- Learning repository (metadata; file via upload endpoint) ----
export const learningRepositorySchema = z.object({
  title: z.string().min(1),
  description: optionalString,
  subjectId: z.string().uuid().optional().nullable(),
  academicYearId: z.string().uuid().optional().nullable(),
  docType: z.enum(['SILABUS', 'RPP', 'MODUL', 'MATERI']),
  fileName: z.string().min(1),
  filePath: z.string().min(1),
  fileSize: z.coerce.number().int().optional().nullable(),
  mimeType: optionalString,
});

// ---- Teacher-subject mapping ----
export const teacherSubjectSchema = z.object({
  employeeId: z.string().uuid(),
  subjectId: z.string().uuid(),
});

// ---- Attendance student ----
export const attendanceStudentSchema = z.object({
  studentId: z.string().uuid(),
  classId: z.string().uuid().optional().nullable(),
  subjectId: z.string().uuid().optional().nullable(),
  date: dateString,
  status: z.enum(['HADIR', 'IZIN', 'SAKIT', 'ALPHA', 'TERLAMBAT']),
  note: optionalString,
});

// ---- Attendance employee (check-in/out) ----
export const attendanceEmployeeSchema = z.object({
  employeeId: z.string().uuid(),
  date: dateString,
  checkIn: optionalDate,
  checkOut: optionalDate,
  status: z.enum(['HADIR', 'IZIN', 'SAKIT', 'ALPHA', 'TERLAMBAT']),
  note: optionalString,
});

// ---- Grade ----
export const gradeSchema = z.object({
  studentId: z.string().uuid(),
  subjectId: z.string().uuid(),
  semesterId: z.string().uuid(),
  type: z.enum(['TUGAS', 'UJIAN', 'PRAKTIK', 'SIKAP', 'TAHFIDZ']),
  score: z.coerce.number().min(0).max(100),
  description: optionalString,
});

// ---- Tahfidz ----
export const tahfidzSchema = z.object({
  studentId: z.string().uuid(),
  surah: z.string().min(1),
  fromAyah: z.coerce.number().int().positive(),
  toAyah: z.coerce.number().int().positive(),
  quality: z.enum(['MUMTAZ', 'JAYYID_JIDDAN', 'JAYYID', 'MAQBUL']),
  teacherNote: optionalString,
  date: dateString,
});

// ---- Mutaba'ah ----
export const mutabaahSchema = z.object({
  studentId: z.string().uuid(),
  date: dateString,
  activity: z.string().min(1),
  value: optionalString,
  note: optionalString,
});

// ---- Invoice ----
export const invoiceSchema = z.object({
  invoiceNumber: z.string().min(1),
  studentId: z.string().uuid(),
  type: z.enum(['UANG_PANGKAL', 'SPP', 'KEGIATAN', 'DAFTAR_ULANG']),
  description: optionalString,
  amount: z.coerce.number().nonnegative(),
  dueDate: optionalDate,
  status: z.enum(['BELUM_BAYAR', 'MENUNGGU_VERIFIKASI', 'LUNAS', 'DITOLAK']).optional(),
});

// ---- Cash transaction ----
export const cashTransactionSchema = z.object({
  code: z.string().min(1),
  type: z.enum(['MASUK', 'KELUAR']),
  category: optionalString,
  description: optionalString,
  amount: z.coerce.number().nonnegative(),
  date: dateString,
});

// ---- Accounting journal ----
export const accountingJournalSchema = z.object({
  date: dateString,
  reference: optionalString,
  description: optionalString,
  debitAccount: optionalString,
  creditAccount: optionalString,
  amount: z.coerce.number().nonnegative(),
});

// ---- Leave request ----
export const leaveRequestSchema = z.object({
  employeeId: z.string().uuid(),
  type: z.enum(['IZIN', 'CUTI', 'SAKIT']),
  startDate: dateString,
  endDate: dateString,
  reason: optionalString,
});

// ---- Asset ----
export const assetSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  category: optionalString,
  location: optionalString,
  condition: z.enum(['BAIK', 'RUSAK_RINGAN', 'RUSAK_BERAT', 'HILANG']).optional(),
  quantity: z.coerce.number().int().nonnegative().optional(),
  acquiredAt: optionalDate,
  maintenanceHistory: optionalString,
});

// ---- Digital archive (metadata) ----
export const digitalArchiveSchema = z.object({
  title: z.string().min(1),
  category: optionalString,
  description: optionalString,
  fileName: z.string().min(1),
  filePath: z.string().min(1),
  fileSize: z.coerce.number().int().optional().nullable(),
  mimeType: optionalString,
});

// ---- Notification ----
export const notificationSchema = z.object({
  userId: z.string().uuid().optional().nullable(),
  title: z.string().min(1),
  message: z.string().min(1),
  type: optionalString,
});
