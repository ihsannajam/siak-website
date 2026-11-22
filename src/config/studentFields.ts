/** Daftar field data siswa An-Nahl, dikelompokkan sesuai bagian formulir. */

export type StudentScope = 'student' | 'family' | 'health'
export type StudentFieldType = 'text' | 'number' | 'date' | 'textarea' | 'select' | 'nik' | 'email'

export interface FieldOption {
  value: string
  label: string
}

export interface StudentField {
  name: string
  label: string
  type?: StudentFieldType
  required?: boolean
  options?: FieldOption[]
  /** Opsi dimuat dari API. */
  dynamicOptions?: 'academicYears' | 'classes'
  noEmpty?: boolean
  wide?: boolean
  /** Field hanya tampil dan tersimpan bila field lain bernilai tertentu. */
  showIf?: { name: string; value: string }
}

export interface StudentSection {
  key: string
  title: string
  scope: StudentScope
  fields: StudentField[]
}

const opts = (...items: [string, string][]): FieldOption[] => items.map(([value, label]) => ({ value, label }))
const same = (...items: string[]): FieldOption[] => items.map((value) => ({ value, label: value }))

const RELIGION = same('Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu')
const NATIONALITY = opts(['WNI', 'WNI'], ['WNA', 'WNA'])
const EDUCATION = same('Tidak Sekolah', 'SD/Sederajat', 'SMP/Sederajat', 'SMA/Sederajat', 'D1', 'D2', 'D3', 'D4/S1', 'S2', 'S3')
const LIFE_STATUS = opts(['HIDUP', 'Hidup'], ['MENINGGAL', 'Meninggal'])

export const GENDER_OPTIONS = opts(['LAKI_LAKI', 'Laki-laki'], ['PEREMPUAN', 'Perempuan'])
export const STUDENT_STATUS_OPTIONS = opts(
  ['AKTIF', 'Aktif'],
  ['PINDAH', 'Pindah'],
  ['LULUS', 'Lulus'],
  ['NONAKTIF', 'Nonaktif'],
  ['MENGUNDURKAN_DIRI', 'Mengundurkan Diri'],
)
export const STUDENT_STATUS_LABEL: Record<string, string> = {
  ...Object.fromEntries(STUDENT_STATUS_OPTIONS.map((o) => [o.value, o.label])),
  DROP_OUT: 'Drop Out',
}

const parentFields = (prefix: 'father' | 'mother', who: 'Ayah' | 'Ibu'): StudentField[] => [
  { name: `${prefix}Name`, label: `Nama Lengkap ${who}` },
  { name: `${prefix}Nik`, label: `NIK ${who}`, type: 'nik' },
  { name: `${prefix}BirthPlace`, label: `Tempat Lahir ${who}` },
  { name: `${prefix}BirthDate`, label: `Tanggal Lahir ${who}`, type: 'date' },
  { name: `${prefix}Religion`, label: `Agama ${who}`, type: 'select', options: RELIGION },
  { name: `${prefix}Nationality`, label: `Kewarganegaraan ${who}`, type: 'select', options: NATIONALITY },
  { name: `${prefix}Education`, label: `Pendidikan Terakhir ${who}`, type: 'select', options: EDUCATION },
  { name: `${prefix}Job`, label: `Pekerjaan ${who}` },
  { name: `${prefix}Income`, label: 'Penghasilan per Bulan (Rp)', type: 'number' },
  { name: `${prefix}Phone`, label: `Nomor HP/WhatsApp ${who}` },
  { name: `${prefix}Email`, label: `Email ${who}`, type: 'email' },
  { name: `${prefix}LifeStatus`, label: `Status ${who}`, type: 'select', options: LIFE_STATUS },
  { name: `${prefix}DeathYear`, label: 'Tahun Meninggal', type: 'number', showIf: { name: `${prefix}LifeStatus`, value: 'MENINGGAL' } },
  { name: `${prefix}Address`, label: `Alamat ${who}`, type: 'textarea', wide: true },
]

export const STUDENT_SECTIONS: StudentSection[] = [
  {
    key: 'identity', title: 'Identitas', scope: 'student', fields: [
      { name: 'nis', label: 'NIS (Nomor Induk Siswa)' },
      { name: 'nisn', label: 'NISN' },
      { name: 'nik', label: 'NIK Siswa', type: 'nik' },
      { name: 'fullName', label: 'Nama Lengkap', required: true },
      { name: 'nickname', label: 'Nama Panggilan' },
      { name: 'gender', label: 'Jenis Kelamin', type: 'select', options: GENDER_OPTIONS, required: true, noEmpty: true },
      { name: 'birthPlace', label: 'Tempat Lahir' },
      { name: 'birthDate', label: 'Tanggal Lahir', type: 'date' },
      { name: 'religion', label: 'Agama', type: 'select', options: RELIGION },
      { name: 'nationality', label: 'Kewarganegaraan', type: 'select', options: NATIONALITY },
      { name: 'childOrder', label: 'Anak Ke-', type: 'number' },
      { name: 'siblingsCount', label: 'Jumlah Saudara Kandung', type: 'number' },
      { name: 'stepSiblingsCount', label: 'Jumlah Saudara Tiri', type: 'number' },
      { name: 'adoptedSiblingsCount', label: 'Jumlah Saudara Angkat', type: 'number' },
      { name: 'childStatus', label: 'Status Anak', type: 'select', options: opts(['LENGKAP', 'Lengkap'], ['YATIM', 'Yatim'], ['PIATU', 'Piatu'], ['YATIM_PIATU', 'Yatim Piatu']) },
      { name: 'dailyLanguage', label: 'Bahasa Sehari-hari' },
    ],
  },
  {
    key: 'address', title: 'Alamat', scope: 'student', fields: [
      { name: 'address', label: 'Alamat Lengkap (Jalan/Gang/Nomor Rumah)', type: 'textarea', wide: true },
      { name: 'village', label: 'Desa/Kelurahan' },
      { name: 'district', label: 'Kecamatan' },
      { name: 'city', label: 'Kota/Kabupaten' },
      { name: 'province', label: 'Provinsi' },
      { name: 'postalCode', label: 'Kode Pos' },
      { name: 'phone', label: 'Nomor HP Siswa' },
      { name: 'email', label: 'Email Siswa', type: 'email' },
      { name: 'livingWith', label: 'Tinggal Bersama', type: 'select', options: opts(['AYAH', 'Ayah'], ['IBU', 'Ibu'], ['ORANG_TUA', 'Orang Tua'], ['WALI', 'Wali'], ['LAINNYA', 'Lainnya']) },
      { name: 'distanceToSchoolKm', label: 'Jarak ke Sekolah (km)', type: 'number' },
    ],
  },
  { key: 'father', title: 'Ayah', scope: 'family', fields: parentFields('father', 'Ayah') },
  { key: 'mother', title: 'Ibu', scope: 'family', fields: parentFields('mother', 'Ibu') },
  {
    key: 'guardian', title: 'Wali', scope: 'family', fields: [
      { name: 'guardianName', label: 'Nama Lengkap Wali' },
      { name: 'guardianNik', label: 'NIK Wali', type: 'nik' },
      { name: 'guardianRelation', label: 'Hubungan dengan Siswa' },
      { name: 'guardianBirthPlace', label: 'Tempat Lahir Wali' },
      { name: 'guardianBirthDate', label: 'Tanggal Lahir Wali', type: 'date' },
      { name: 'guardianReligion', label: 'Agama Wali', type: 'select', options: RELIGION },
      { name: 'guardianEducation', label: 'Pendidikan Terakhir Wali', type: 'select', options: EDUCATION },
      { name: 'guardianJob', label: 'Pekerjaan Wali' },
      { name: 'guardianIncome', label: 'Penghasilan per Bulan (Rp)', type: 'number' },
      { name: 'guardianPhone', label: 'Nomor HP/WhatsApp Wali' },
      { name: 'guardianEmail', label: 'Email Wali', type: 'email' },
      { name: 'guardianAddress', label: 'Alamat Wali', type: 'textarea', wide: true },
    ],
  },
  {
    key: 'admission', title: 'Penerimaan', scope: 'student', fields: [
      { name: 'registrationNumber', label: 'Nomor Pendaftaran' },
      { name: 'registrationDate', label: 'Tanggal Pendaftaran', type: 'date' },
      { name: 'entryAcademicYearId', label: 'Tahun Ajaran Masuk', type: 'select', dynamicOptions: 'academicYears' },
      { name: 'educationProgram', label: 'Jenjang/Program Pendidikan' },
      { name: 'admissionType', label: 'Status Pendaftaran', type: 'select', options: opts(['SISWA_BARU', 'Siswa Baru'], ['PINDAHAN', 'Pindahan']) },
      { name: 'admissionClassId', label: 'Kelas Saat Diterima', type: 'select', dynamicOptions: 'classes' },
      { name: 'startStudyDate', label: 'Tanggal Mulai Belajar', type: 'date' },
      { name: 'status', label: 'Status Siswa', type: 'select', options: STUDENT_STATUS_OPTIONS, required: true, noEmpty: true },
    ],
  },
  {
    key: 'health', title: 'Kesehatan', scope: 'health', fields: [
      { name: 'bloodType', label: 'Golongan Darah', type: 'select', options: same('A', 'B', 'AB', 'O') },
      { name: 'height', label: 'Tinggi Badan (cm)', type: 'number' },
      { name: 'weight', label: 'Berat Badan (kg)', type: 'number' },
      { name: 'diseaseHistory', label: 'Riwayat Penyakit', type: 'textarea' },
      { name: 'foodAllergies', label: 'Alergi Makanan', type: 'textarea' },
      { name: 'drugAllergies', label: 'Alergi Obat', type: 'textarea' },
      { name: 'physicalCondition', label: 'Kondisi/Kelainan Fisik yang Perlu Diperhatikan', type: 'textarea' },
      { name: 'specialNeeds', label: 'Kebutuhan Khusus', type: 'textarea' },
      { name: 'notes', label: 'Catatan Kesehatan Tambahan', type: 'textarea', wide: true },
    ],
  },
]

export const EDUCATION_FIELDS: StudentField[] = [
  { name: 'level', label: 'Jenjang Pendidikan', type: 'select', required: true, options: same('PAUD', 'TK', 'SD', 'SMP', 'SMA') },
  { name: 'schoolName', label: 'Nama Sekolah', required: true },
  { name: 'npsn', label: 'NPSN Sekolah' },
  { name: 'schoolStatus', label: 'Status Sekolah', type: 'select', options: opts(['NEGERI', 'Negeri'], ['SWASTA', 'Swasta']) },
  { name: 'entryYear', label: 'Tahun Masuk', type: 'number' },
  { name: 'exitYear', label: 'Tahun Keluar', type: 'number' },
  { name: 'lastClass', label: 'Kelas Terakhir' },
  { name: 'educationStatus', label: 'Status Pendidikan', type: 'select', options: opts(['LULUS', 'Lulus'], ['PINDAH', 'Pindah'], ['BELUM_LULUS', 'Belum Lulus']) },
  { name: 'diplomaNumber', label: 'Nomor Ijazah' },
  { name: 'diplomaDate', label: 'Tanggal Ijazah', type: 'date' },
  { name: 'skhunNumber', label: 'Nomor SKHUN' },
  { name: 'skhunDate', label: 'Tanggal SKHUN', type: 'date' },
  { name: 'studyDuration', label: 'Lama Belajar' },
  { name: 'schoolAddress', label: 'Alamat Sekolah', type: 'textarea', wide: true },
  { name: 'notes', label: 'Keterangan Tambahan', type: 'textarea', wide: true },
]

export const REQUIRED_DOCUMENTS: (FieldOption & { sensitive?: boolean; imageOnly?: boolean })[] = [
  { value: 'AKTA_KELAHIRAN', label: 'Akta Kelahiran', sensitive: true },
  { value: 'KARTU_KELUARGA', label: 'Kartu Keluarga', sensitive: true },
  { value: 'KTP_AYAH', label: 'KTP Ayah', sensitive: true },
  { value: 'KTP_IBU', label: 'KTP Ibu', sensitive: true },
  { value: 'KTP_WALI', label: 'KTP Wali (jika ada)', sensitive: true },
  { value: 'IJAZAH_SKL', label: 'Ijazah/SKL Sebelumnya' },
  { value: 'SURAT_PINDAH', label: 'Surat Pindah (jika ada)' },
  { value: 'PAS_FOTO', label: 'Pas Foto Siswa', imageOnly: true },
]

export const DOCUMENT_LABEL: Record<string, string> = {
  ...Object.fromEntries(REQUIRED_DOCUMENTS.map((d) => [d.value, d.label])),
  IJAZAH: 'Ijazah',
  FOTO: 'Foto Profil',
  LAINNYA: 'Lainnya',
}
