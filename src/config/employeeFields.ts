export interface EmployeeOption {
  value: string
  label: string
}

export interface EmployeeField {
  name: string
  label: string
  type?: 'text' | 'textarea' | 'date' | 'year' | 'email' | 'nik' | 'select'
  options?: EmployeeOption[]
  required?: boolean
  noEmpty?: boolean
  wide?: boolean
  /** Data pribadi: tidak dikirim server untuk pengguna yang hanya bisa melihat. */
  personal?: boolean
}

const same = (...values: string[]) => values.map((value) => ({ value, label: value }))

export const CATEGORY_OPTIONS = [
  { value: 'GURU', label: 'Guru' },
  { value: 'TENAGA_KEPENDIDIKAN', label: 'Tenaga Kependidikan' },
  { value: 'KARYAWAN', label: 'Karyawan' },
]
// Nilai HONORER dipertahankan agar data lama tetap terbaca sebagai Tidak Tetap.
export const EMPLOYMENT_OPTIONS = [
  { value: 'TETAP', label: 'Tetap' },
  { value: 'KONTRAK', label: 'Kontrak' },
  { value: 'HONORER', label: 'Tidak Tetap' },
]
export const ACTIVE_OPTIONS = [
  { value: 'AKTIF', label: 'Aktif' },
  { value: 'CUTI', label: 'Cuti' },
  { value: 'NONAKTIF', label: 'Nonaktif' },
  { value: 'KELUAR', label: 'Keluar' },
]
export const labelOf = (options: EmployeeOption[], value?: string | null) =>
  options.find((o) => o.value === value)?.label ?? value ?? '-'

export const IDENTITY_FIELDS: EmployeeField[] = [
  { name: 'nip', label: 'ID Personel / Nomor Induk Pegawai' },
  { name: 'nuptk', label: 'NUPTK' },
  { name: 'nik', label: 'NIK', type: 'nik', personal: true },
  { name: 'fullName', label: 'Nama Lengkap', required: true },
  { name: 'gender', label: 'Jenis Kelamin', type: 'select', options: [{ value: 'LAKI_LAKI', label: 'Laki-laki' }, { value: 'PEREMPUAN', label: 'Perempuan' }] },
  { name: 'birthPlace', label: 'Tempat Lahir', personal: true },
  { name: 'birthDate', label: 'Tanggal Lahir', type: 'date', personal: true },
  { name: 'religion', label: 'Agama', type: 'select', options: same('Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu'), personal: true },
  { name: 'maritalStatus', label: 'Status Perkawinan', type: 'select', options: same('Belum Menikah', 'Menikah', 'Cerai Hidup', 'Cerai Mati'), personal: true },
  { name: 'phone', label: 'Nomor HP/WhatsApp', personal: true },
  { name: 'email', label: 'Email', type: 'email', personal: true },
  { name: 'address', label: 'Alamat Lengkap', type: 'textarea', wide: true, personal: true },
]

export const EMPLOYMENT_FIELDS: EmployeeField[] = [
  { name: 'personnelCategory', label: 'Kategori Personel', type: 'select', options: CATEGORY_OPTIONS, required: true },
  { name: 'position', label: 'Jabatan', required: true },
  { name: 'employmentStatus', label: 'Status Kepegawaian', type: 'select', options: EMPLOYMENT_OPTIONS, noEmpty: true },
  { name: 'workStartDate', label: 'Tanggal Mulai Bekerja', type: 'date' },
  { name: 'appointmentDecreeNumber', label: 'Nomor SK Pengangkatan' },
  { name: 'activeStatus', label: 'Status Keaktifan', type: 'select', options: ACTIVE_OPTIONS, noEmpty: true },
  { name: 'bankName', label: 'Nama Bank', personal: true },
  { name: 'bankAccount', label: 'Nomor Rekening', personal: true },
]

export const EDUCATION_FIELDS: EmployeeField[] = [
  { name: 'lastEducation', label: 'Pendidikan Terakhir', type: 'select', options: same('SMA/Sederajat', 'D1', 'D2', 'D3', 'D4/S1', 'S2', 'S3') },
  { name: 'studyProgram', label: 'Jurusan/Program Studi' },
  { name: 'institutionName', label: 'Nama Sekolah/Perguruan Tinggi' },
  { name: 'graduationYear', label: 'Tahun Lulus', type: 'year' },
  { name: 'academicTitle', label: 'Gelar Akademik' },
  { name: 'certification', label: 'Sertifikasi Pendidik' },
  { name: 'educationHistory', label: 'Catatan Riwayat Pendidikan', type: 'textarea', wide: true },
]

export const ASSIGNMENT_FIELDS: EmployeeField[] = [
  { name: 'additionalDuties', label: 'Tugas Tambahan', type: 'textarea', wide: true },
]

export const TRAINING_FIELDS: EmployeeField[] = [
  { name: 'name', label: 'Nama Pelatihan/Sertifikat', required: true },
  { name: 'organizer', label: 'Penyelenggara' },
  { name: 'year', label: 'Tahun', type: 'year' },
  { name: 'certificateNumber', label: 'Nomor Sertifikat' },
]

export const ALL_EMPLOYEE_FIELDS = [...IDENTITY_FIELDS, ...EMPLOYMENT_FIELDS, ...EDUCATION_FIELDS, ...ASSIGNMENT_FIELDS]

export const EMPLOYEE_DOCUMENTS = [
  { value: 'FOTO', label: 'Foto Profil', imageOnly: true },
  { value: 'KTP', label: 'Scan KTP' },
  { value: 'KK', label: 'Kartu Keluarga' },
  { value: 'IJAZAH', label: 'Ijazah Terakhir' },
  { value: 'SK', label: 'SK Pengangkatan' },
  { value: 'SERTIFIKAT', label: 'Sertifikat Pendidik/Pelatihan' },
]

export const DAY_LABEL: Record<number, string> = {
  1: 'Senin', 2: 'Selasa', 3: 'Rabu', 4: 'Kamis', 5: 'Jumat', 6: 'Sabtu', 7: 'Minggu',
}

/** Masa kerja dihitung dari Tanggal Mulai Bekerja. */
export function serviceLength(start?: string | null, today = new Date()): string {
  if (!start) return '-'
  const from = new Date(start)
  if (Number.isNaN(from.getTime())) return '-'
  let months = (today.getFullYear() - from.getUTCFullYear()) * 12 + today.getMonth() - from.getUTCMonth()
  if (today.getDate() < from.getUTCDate()) months -= 1
  if (months < 0) return 'Belum mulai'
  const years = Math.floor(months / 12)
  const rest = months % 12
  if (!years) return `${rest} bulan`
  return rest ? `${years} tahun ${rest} bulan` : `${years} tahun`
}
