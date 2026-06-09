/**
 * Declarative config for generic CRUD pages. Each module describes its API path,
 * table columns, and form fields. The <CrudPage> component renders list + form
 * entirely from this metadata, so adding a master-data screen is one entry here.
 */

export type FieldType = 'text' | 'number' | 'textarea' | 'date' | 'select' | 'checkbox'

export interface FieldDef {
  name: string
  label: string
  type?: FieldType
  required?: boolean
  options?: { value: string; label: string }[]
  /** load options from another module endpoint: { path, labelKey } */
  optionsFrom?: { path: string; labelKey: string; valueKey?: string }
  placeholder?: string
  hideInTable?: boolean
}

export interface ColumnDef {
  key: string
  label: string
  /** render relation, e.g. 'academicYear.name' */
  accessor?: string
}

export interface ModuleConfig {
  key: string
  title: string
  apiPath: string
  permissionKey: string
  columns: ColumnDef[]
  fields: FieldDef[]
}

const GENDER = [
  { value: 'LAKI_LAKI', label: 'Laki-laki' },
  { value: 'PEREMPUAN', label: 'Perempuan' },
]

export const MODULE_CONFIGS: Record<string, ModuleConfig> = {
  'academic-years': {
    key: 'academic-years',
    title: 'Tahun Ajaran',
    apiPath: '/academic-years',
    permissionKey: 'academic-years',
    columns: [
      { key: 'name', label: 'Tahun Ajaran' },
      { key: 'startDate', label: 'Mulai' },
      { key: 'endDate', label: 'Selesai' },
      { key: 'isActive', label: 'Aktif' },
    ],
    fields: [
      { name: 'name', label: 'Nama (mis. 2025/2026)', required: true },
      { name: 'startDate', label: 'Tanggal Mulai', type: 'date', required: true },
      { name: 'endDate', label: 'Tanggal Selesai', type: 'date', required: true },
      { name: 'isActive', label: 'Aktifkan', type: 'checkbox' },
    ],
  },

  semesters: {
    key: 'semesters',
    title: 'Semester',
    apiPath: '/semesters',
    permissionKey: 'semesters',
    columns: [
      { key: 'academicYear', label: 'Tahun Ajaran', accessor: 'academicYear.name' },
      { key: 'type', label: 'Semester' },
      { key: 'isActive', label: 'Aktif' },
    ],
    fields: [
      {
        name: 'academicYearId',
        label: 'Tahun Ajaran',
        type: 'select',
        required: true,
        optionsFrom: { path: '/academic-years', labelKey: 'name' },
      },
      {
        name: 'type',
        label: 'Semester',
        type: 'select',
        required: true,
        options: [
          { value: 'GANJIL', label: 'Ganjil' },
          { value: 'GENAP', label: 'Genap' },
        ],
      },
      { name: 'isActive', label: 'Aktifkan (semester berjalan)', type: 'checkbox' },
    ],
  },

  'school-profile': {
    key: 'school-profile',
    title: 'Identitas Sekolah',
    apiPath: '/school-profile',
    permissionKey: 'school-profile',
    columns: [
      { key: 'name', label: 'Nama Sekolah' },
      { key: 'npsn', label: 'NPSN' },
      { key: 'phone', label: 'Telepon' },
      { key: 'headmaster', label: 'Kepala Sekolah' },
    ],
    fields: [
      { name: 'name', label: 'Nama Sekolah', required: true },
      { name: 'npsn', label: 'NPSN' },
      { name: 'address', label: 'Alamat', type: 'textarea' },
      { name: 'phone', label: 'Telepon' },
      { name: 'email', label: 'Email' },
      { name: 'website', label: 'Website' },
      { name: 'headmaster', label: 'Kepala Sekolah' },
    ],
  },

  'teacher-subjects': {
    key: 'teacher-subjects',
    title: 'Mapping Guru - Mapel',
    apiPath: '/teacher-subjects',
    permissionKey: 'teacher-subjects',
    columns: [
      { key: 'employee', label: 'Guru', accessor: 'employee.fullName' },
      { key: 'subject', label: 'Mata Pelajaran', accessor: 'subject.name' },
    ],
    fields: [
      {
        name: 'employeeId',
        label: 'Guru',
        type: 'select',
        required: true,
        optionsFrom: { path: '/employees', labelKey: 'fullName' },
      },
      {
        name: 'subjectId',
        label: 'Mata Pelajaran',
        type: 'select',
        required: true,
        optionsFrom: { path: '/subjects', labelKey: 'name' },
      },
    ],
  },

  'learning-repositories': {
    key: 'learning-repositories',
    title: 'Learning Repository',
    apiPath: '/learning-repositories',
    permissionKey: 'learning-repositories',
    columns: [
      { key: 'title', label: 'Judul' },
      { key: 'docType', label: 'Jenis' },
      { key: 'fileName', label: 'Berkas' },
    ],
    fields: [
      { name: 'title', label: 'Judul', required: true },
      {
        name: 'docType',
        label: 'Jenis Dokumen',
        type: 'select',
        required: true,
        options: [
          { value: 'SILABUS', label: 'Silabus' },
          { value: 'RPP', label: 'RPP' },
          { value: 'MODUL', label: 'Modul Ajar' },
          { value: 'MATERI', label: 'Materi' },
        ],
      },
      {
        name: 'subjectId',
        label: 'Mata Pelajaran',
        type: 'select',
        optionsFrom: { path: '/subjects', labelKey: 'name' },
      },
      { name: 'fileName', label: 'Nama Berkas', required: true },
      { name: 'filePath', label: 'Path/URL Berkas', required: true },
      { name: 'description', label: 'Deskripsi', type: 'textarea' },
    ],
  },

  'accounting-journals': {
    key: 'accounting-journals',
    title: 'Jurnal Keuangan',
    apiPath: '/accounting-journals',
    permissionKey: 'accounting-journals',
    columns: [
      { key: 'date', label: 'Tanggal' },
      { key: 'reference', label: 'Referensi' },
      { key: 'debitAccount', label: 'Debit' },
      { key: 'creditAccount', label: 'Kredit' },
      { key: 'amount', label: 'Jumlah' },
    ],
    fields: [
      { name: 'date', label: 'Tanggal', type: 'date', required: true },
      { name: 'reference', label: 'Referensi' },
      { name: 'debitAccount', label: 'Akun Debit' },
      { name: 'creditAccount', label: 'Akun Kredit' },
      { name: 'amount', label: 'Jumlah (Rp)', type: 'number', required: true },
      { name: 'description', label: 'Keterangan', type: 'textarea' },
    ],
  },

  notifications: {
    key: 'notifications',
    title: 'Notifikasi',
    apiPath: '/notifications',
    permissionKey: 'notifications',
    columns: [
      { key: 'title', label: 'Judul' },
      { key: 'type', label: 'Tipe' },
      { key: 'isRead', label: 'Dibaca' },
    ],
    fields: [
      { name: 'title', label: 'Judul', required: true },
      { name: 'message', label: 'Pesan', type: 'textarea', required: true },
      {
        name: 'type',
        label: 'Tipe',
        type: 'select',
        options: [
          { value: 'INFO', label: 'Info' },
          { value: 'WARNING', label: 'Peringatan' },
          { value: 'TAGIHAN', label: 'Tagihan' },
          { value: 'DEADLINE', label: 'Deadline' },
        ],
      },
    ],
  },

  subjects: {
    key: 'subjects',
    title: 'Mata Pelajaran',
    apiPath: '/subjects',
    permissionKey: 'subjects',
    columns: [
      { key: 'code', label: 'Kode' },
      { key: 'name', label: 'Nama' },
      { key: 'category', label: 'Kategori' },
    ],
    fields: [
      { name: 'code', label: 'Kode', required: true },
      { name: 'name', label: 'Nama Mapel', required: true },
      { name: 'category', label: 'Kategori' },
      { name: 'description', label: 'Deskripsi', type: 'textarea' },
    ],
  },

  curriculums: {
    key: 'curriculums',
    title: 'Kurikulum',
    apiPath: '/curriculums',
    permissionKey: 'curriculums',
    columns: [
      { key: 'name', label: 'Nama' },
      { key: 'code', label: 'Kode' },
      { key: 'isActive', label: 'Aktif' },
    ],
    fields: [
      { name: 'name', label: 'Nama Kurikulum', required: true },
      { name: 'code', label: 'Kode' },
      { name: 'description', label: 'Deskripsi', type: 'textarea' },
      { name: 'isActive', label: 'Aktif', type: 'checkbox' },
    ],
  },

  classrooms: {
    key: 'classrooms',
    title: 'Ruang Kelas',
    apiPath: '/classrooms',
    permissionKey: 'classrooms',
    columns: [
      { key: 'code', label: 'Kode' },
      { key: 'name', label: 'Nama' },
      { key: 'capacity', label: 'Kapasitas' },
      { key: 'location', label: 'Lokasi' },
    ],
    fields: [
      { name: 'code', label: 'Kode', required: true },
      { name: 'name', label: 'Nama Ruang', required: true },
      { name: 'capacity', label: 'Kapasitas', type: 'number' },
      { name: 'location', label: 'Lokasi' },
    ],
  },

  classes: {
    key: 'classes',
    title: 'Rombel / Kelas',
    apiPath: '/classes',
    permissionKey: 'classes',
    columns: [
      { key: 'name', label: 'Nama Kelas' },
      { key: 'gradeLevel', label: 'Tingkat' },
      { key: 'academicYear', label: 'Tahun Ajaran', accessor: 'academicYear.name' },
      { key: 'capacity', label: 'Kapasitas' },
    ],
    fields: [
      { name: 'name', label: 'Nama Kelas', required: true },
      { name: 'gradeLevel', label: 'Tingkat', required: true },
      {
        name: 'academicYearId',
        label: 'Tahun Ajaran',
        type: 'select',
        required: true,
        optionsFrom: { path: '/academic-years', labelKey: 'name' },
      },
      {
        name: 'homeroomTeacherId',
        label: 'Wali Kelas',
        type: 'select',
        optionsFrom: { path: '/employees', labelKey: 'fullName' },
      },
      { name: 'capacity', label: 'Kapasitas', type: 'number' },
    ],
  },

  'academic-calendars': {
    key: 'academic-calendars',
    title: 'Kalender Akademik',
    apiPath: '/academic-calendars',
    permissionKey: 'academic-calendars',
    columns: [
      { key: 'title', label: 'Judul' },
      { key: 'category', label: 'Kategori' },
      { key: 'startDate', label: 'Mulai' },
      { key: 'endDate', label: 'Selesai' },
    ],
    fields: [
      { name: 'title', label: 'Judul', required: true },
      {
        name: 'category',
        label: 'Kategori',
        type: 'select',
        required: true,
        options: [
          { value: 'LIBUR_NASIONAL', label: 'Libur Nasional' },
          { value: 'LIBUR_SEKOLAH', label: 'Libur Sekolah' },
          { value: 'AGENDA', label: 'Agenda' },
        ],
      },
      { name: 'startDate', label: 'Tanggal Mulai', type: 'date', required: true },
      { name: 'endDate', label: 'Tanggal Selesai', type: 'date', required: true },
      { name: 'isHoliday', label: 'Hari Libur', type: 'checkbox' },
      { name: 'description', label: 'Deskripsi', type: 'textarea' },
    ],
  },

  employees: {
    key: 'employees',
    title: 'Data Pegawai',
    apiPath: '/employees',
    permissionKey: 'employees',
    columns: [
      { key: 'fullName', label: 'Nama' },
      { key: 'position', label: 'Jabatan' },
      { key: 'employmentStatus', label: 'Status' },
      { key: 'phone', label: 'Telepon' },
    ],
    fields: [
      { name: 'fullName', label: 'Nama Lengkap', required: true },
      { name: 'nip', label: 'NIP' },
      { name: 'nuptk', label: 'NUPTK' },
      { name: 'nik', label: 'NIK' },
      { name: 'gender', label: 'Jenis Kelamin', type: 'select', options: GENDER },
      { name: 'position', label: 'Jabatan', required: true },
      {
        name: 'employmentStatus',
        label: 'Status Kepegawaian',
        type: 'select',
        options: [
          { value: 'TETAP', label: 'Tetap' },
          { value: 'KONTRAK', label: 'Kontrak' },
          { value: 'HONORER', label: 'Honorer' },
        ],
      },
      { name: 'phone', label: 'Telepon' },
      { name: 'email', label: 'Email' },
      { name: 'address', label: 'Alamat', type: 'textarea' },
      { name: 'bankName', label: 'Nama Bank' },
      { name: 'bankAccount', label: 'No. Rekening' },
    ],
  },

  assets: {
    key: 'assets',
    title: 'Sarana & Prasarana',
    apiPath: '/assets',
    permissionKey: 'assets',
    columns: [
      { key: 'code', label: 'Kode' },
      { key: 'name', label: 'Nama Aset' },
      { key: 'category', label: 'Kategori' },
      { key: 'location', label: 'Lokasi' },
      { key: 'condition', label: 'Kondisi' },
      { key: 'quantity', label: 'Jumlah' },
    ],
    fields: [
      { name: 'code', label: 'Kode Aset', required: true },
      { name: 'name', label: 'Nama Aset', required: true },
      { name: 'category', label: 'Kategori' },
      { name: 'location', label: 'Lokasi' },
      {
        name: 'condition',
        label: 'Kondisi',
        type: 'select',
        options: [
          { value: 'BAIK', label: 'Baik' },
          { value: 'RUSAK_RINGAN', label: 'Rusak Ringan' },
          { value: 'RUSAK_BERAT', label: 'Rusak Berat' },
          { value: 'HILANG', label: 'Hilang' },
        ],
      },
      { name: 'quantity', label: 'Jumlah', type: 'number' },
      { name: 'maintenanceHistory', label: 'Riwayat Pemeliharaan', type: 'textarea' },
    ],
  },

  'cash-transactions': {
    key: 'cash-transactions',
    title: 'Kas Masuk / Keluar',
    apiPath: '/cash-transactions',
    permissionKey: 'cash-transactions',
    columns: [
      { key: 'code', label: 'Kode' },
      { key: 'type', label: 'Tipe' },
      { key: 'category', label: 'Kategori' },
      { key: 'amount', label: 'Jumlah' },
      { key: 'date', label: 'Tanggal' },
    ],
    fields: [
      { name: 'code', label: 'Kode', required: true },
      {
        name: 'type',
        label: 'Tipe',
        type: 'select',
        required: true,
        options: [
          { value: 'MASUK', label: 'Kas Masuk' },
          { value: 'KELUAR', label: 'Kas Keluar' },
        ],
      },
      { name: 'category', label: 'Kategori' },
      { name: 'amount', label: 'Jumlah (Rp)', type: 'number', required: true },
      { name: 'date', label: 'Tanggal', type: 'date', required: true },
      { name: 'description', label: 'Keterangan', type: 'textarea' },
    ],
  },

  invoices: {
    key: 'invoices',
    title: 'Tagihan Siswa',
    apiPath: '/invoices',
    permissionKey: 'invoices',
    columns: [
      { key: 'invoiceNumber', label: 'No. Tagihan' },
      { key: 'student', label: 'Siswa', accessor: 'student.fullName' },
      { key: 'type', label: 'Jenis' },
      { key: 'amount', label: 'Jumlah' },
      { key: 'status', label: 'Status' },
    ],
    fields: [
      { name: 'invoiceNumber', label: 'No. Tagihan', required: true },
      {
        name: 'studentId',
        label: 'Siswa',
        type: 'select',
        required: true,
        optionsFrom: { path: '/students', labelKey: 'fullName' },
      },
      {
        name: 'type',
        label: 'Jenis Tagihan',
        type: 'select',
        required: true,
        options: [
          { value: 'UANG_PANGKAL', label: 'Uang Pangkal' },
          { value: 'SPP', label: 'SPP' },
          { value: 'KEGIATAN', label: 'Kegiatan' },
          { value: 'DAFTAR_ULANG', label: 'Daftar Ulang' },
        ],
      },
      { name: 'amount', label: 'Jumlah (Rp)', type: 'number', required: true },
      { name: 'dueDate', label: 'Jatuh Tempo', type: 'date' },
      { name: 'description', label: 'Keterangan', type: 'textarea' },
    ],
  },

  'digital-archives': {
    key: 'digital-archives',
    title: 'Arsip Digital Institusi',
    apiPath: '/digital-archives',
    permissionKey: 'digital-archives',
    columns: [
      { key: 'title', label: 'Judul' },
      { key: 'category', label: 'Kategori' },
      { key: 'fileName', label: 'Berkas' },
    ],
    fields: [
      { name: 'title', label: 'Judul', required: true },
      { name: 'category', label: 'Kategori' },
      { name: 'description', label: 'Deskripsi', type: 'textarea' },
      { name: 'fileName', label: 'Nama Berkas', required: true },
      { name: 'filePath', label: 'Path/URL Berkas', required: true },
    ],
  },
}

export function getModuleConfig(key: string): ModuleConfig | undefined {
  return MODULE_CONFIGS[key]
}
