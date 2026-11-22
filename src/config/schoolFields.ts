export interface SchoolField {
  name: string
  label: string
  type?: 'text' | 'textarea' | 'date' | 'time' | 'year' | 'email' | 'url' | 'select'
  options?: { value: string; label: string }[]
  required?: boolean
  wide?: boolean
  /** Data pribadi: tidak dikirim server untuk pengguna yang hanya bisa melihat. */
  personal?: boolean
}

export interface SchoolSection {
  key: string
  title: string
  fields: SchoolField[]
}

const foundationName: SchoolField = { name: 'foundationName', label: 'Nama Yayasan' }

export const SCHOOL_SECTIONS: SchoolSection[] = [
  {
    key: 'general', title: 'A. Identitas Umum', fields: [
      { name: 'name', label: 'Nama Resmi Sekolah', required: true, wide: true },
      { name: 'educationLevel', label: 'Jenjang Pendidikan' },
      { name: 'institutionType', label: 'Jenis Satuan Pendidikan' },
      { name: 'schoolStatus', label: 'Status Sekolah', type: 'select', options: [{ value: 'NEGERI', label: 'Negeri' }, { value: 'SWASTA', label: 'Swasta' }] },
      { name: 'npsn', label: 'NPSN' },
      { name: 'foundedYear', label: 'Tahun Berdiri', type: 'year' },
      { name: 'accreditation', label: 'Akreditasi Sekolah' },
      { name: 'accreditationYear', label: 'Tahun Akreditasi', type: 'year' },
    ],
  },
  {
    key: 'legal', title: 'B. Legalitas', fields: [
      foundationName,
      { name: 'establishmentDecreeNumber', label: 'Nomor SK Pendirian' },
      { name: 'establishmentDecreeDate', label: 'Tanggal SK Pendirian', type: 'date' },
      { name: 'operationalPermitNumber', label: 'Nomor Izin Operasional' },
      { name: 'operationalPermitDate', label: 'Tanggal Izin Operasional', type: 'date' },
      { name: 'accreditationDecreeNumber', label: 'Nomor SK Akreditasi' },
      { name: 'npwp', label: 'Nomor NPWP Sekolah' },
    ],
  },
  {
    key: 'contact', title: 'C. Alamat & Kontak', fields: [
      { name: 'address', label: 'Alamat Lengkap Sekolah', type: 'textarea', wide: true },
      { name: 'rtRw', label: 'RT/RW' },
      { name: 'village', label: 'Kelurahan/Desa' },
      { name: 'district', label: 'Kecamatan' },
      { name: 'city', label: 'Kota/Kabupaten' },
      { name: 'province', label: 'Provinsi' },
      { name: 'postalCode', label: 'Kode Pos' },
      { name: 'phone', label: 'Nomor Telepon Sekolah' },
      { name: 'whatsapp', label: 'Nomor WhatsApp Sekolah' },
      { name: 'email', label: 'Email Resmi Sekolah', type: 'email' },
      { name: 'website', label: 'Website Sekolah', type: 'url' },
      { name: 'googleMapsUrl', label: 'Link Google Maps', type: 'url' },
    ],
  },
  {
    key: 'headmaster', title: 'D. Kepala Sekolah', fields: [
      { name: 'headmaster', label: 'Nama Kepala Sekolah' },
      { name: 'headmasterNipNik', label: 'NIP/NIK Kepala Sekolah', personal: true },
      { name: 'headmasterBirthPlace', label: 'Tempat Lahir', personal: true },
      { name: 'headmasterBirthDate', label: 'Tanggal Lahir', type: 'date', personal: true },
      { name: 'headmasterEducation', label: 'Pendidikan Terakhir' },
      { name: 'headmasterPhone', label: 'Nomor HP', personal: true },
      { name: 'headmasterEmail', label: 'Email', type: 'email', personal: true },
      { name: 'headmasterStartDate', label: 'Tanggal Mulai Menjabat', type: 'date' },
    ],
  },
  {
    key: 'foundation', title: 'E. Yayasan', fields: [
      foundationName,
      { name: 'foundationChairman', label: 'Nama Ketua Yayasan' },
      { name: 'foundationPhone', label: 'Nomor Telepon Yayasan' },
      { name: 'foundationEmail', label: 'Email Yayasan', type: 'email' },
      { name: 'foundationDeedNumber', label: 'Nomor Akta Pendirian Yayasan' },
      { name: 'foundationSkNumber', label: 'Nomor SK Kemenkumham' },
      { name: 'foundationAddress', label: 'Alamat Yayasan', type: 'textarea', wide: true },
    ],
  },
  {
    key: 'branding', title: 'F. Visual & Branding', fields: [
      { name: 'tagline', label: 'Slogan/Tagline Sekolah', wide: true },
      { name: 'vision', label: 'Visi Sekolah', type: 'textarea', wide: true },
      { name: 'mission', label: 'Misi Sekolah', type: 'textarea', wide: true },
      { name: 'goals', label: 'Tujuan Sekolah', type: 'textarea', wide: true },
    ],
  },
  {
    key: 'operations', title: 'G. Operasional', fields: [
      { name: 'operatingHours', label: 'Waktu Operasional Sekolah' },
      { name: 'effectiveDays', label: 'Hari Efektif Sekolah' },
      { name: 'entryTime', label: 'Jam Masuk Sekolah', type: 'time' },
      { name: 'educationPrograms', label: 'Jenjang/Program yang Diselenggarakan', type: 'textarea', wide: true },
    ],
  },
  {
    key: 'digital', title: 'H. Digital', fields: [
      { name: 'facebookUrl', label: 'Link Facebook Sekolah', type: 'url' },
      { name: 'instagramUrl', label: 'Link Instagram Sekolah', type: 'url' },
      { name: 'youtubeUrl', label: 'Link YouTube Sekolah', type: 'url' },
      { name: 'tiktokUrl', label: 'Link TikTok Sekolah', type: 'url' },
      { name: 'whatsappCenterUrl', label: 'Link WhatsApp Center', type: 'url' },
    ],
  },
]

export const SCHOOL_IMAGES = [
  { kind: 'logo', key: 'logo', label: 'Logo Resmi Sekolah' },
  { kind: 'foundation-logo', key: 'foundationLogo', label: 'Logo Yayasan' },
  { kind: 'building-photo', key: 'buildingPhoto', label: 'Foto Gedung Sekolah' },
] as const
