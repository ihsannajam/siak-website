/**
 * Central RBAC catalog.
 *
 *  - MODULES: every functional module + the menu metadata the frontend uses to
 *    render a permission-driven sidebar.
 *  - PERMISSIONS: derived as `${module}.${action}`.
 *  - ROLE_PERMISSIONS: which permissions each default role receives, encoding the
 *    Business Rules in section G.
 */

export const ROLES = {
  ADMIN_TU: 'ADMIN_TU',
  GURU: 'GURU',
  KEPALA_SEKOLAH: 'KEPALA_SEKOLAH',
  YAYASAN: 'YAYASAN',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

export const ACTIONS = ['read', 'create', 'update', 'delete'] as const;
export type Action = (typeof ACTIONS)[number];

/** Module catalog: key = permission/module slug, used for menu + permissions. */
export interface ModuleDef {
  key: string;
  label: string;
  icon: string;
  group: string;
  /** which actions are meaningful for this module (default all) */
  actions?: Action[];
}

export const MODULES: ModuleDef[] = [
  // Administrasi / RBAC
  { key: 'users', label: 'Manajemen User', icon: 'users', group: 'Administrasi' },
  { key: 'roles', label: 'Manajemen Role', icon: 'shield', group: 'Administrasi' },
  { key: 'permissions', label: 'Manajemen Permission', icon: 'key', group: 'Administrasi' },
  { key: 'audit-logs', label: 'Audit Log', icon: 'history', group: 'Administrasi', actions: ['read'] },

  // Master Data Institusi
  { key: 'school-profile', label: 'Identitas Sekolah', icon: 'school', group: 'Master Institusi' },
  { key: 'academic-years', label: 'Tahun Ajaran', icon: 'calendar', group: 'Master Institusi' },
  { key: 'semesters', label: 'Semester', icon: 'calendar-range', group: 'Master Institusi' },
  { key: 'academic-calendars', label: 'Kalender Akademik', icon: 'calendar-days', group: 'Master Institusi' },
  { key: 'subjects', label: 'Mata Pelajaran', icon: 'book', group: 'Master Institusi' },
  { key: 'curriculums', label: 'Kurikulum', icon: 'book-open', group: 'Master Institusi' },
  { key: 'classes', label: 'Rombel / Kelas', icon: 'layout-grid', group: 'Master Institusi' },
  { key: 'classrooms', label: 'Ruang Kelas', icon: 'door-open', group: 'Master Institusi' },
  { key: 'digital-archives', label: 'Arsip Digital Institusi', icon: 'archive', group: 'Master Institusi' },

  // Master Data Siswa
  { key: 'students', label: 'Data Siswa', icon: 'graduation-cap', group: 'Kesiswaan' },
  { key: 'student-documents', label: 'Dokumen Siswa', icon: 'file-text', group: 'Kesiswaan' },

  // Kepegawaian
  { key: 'employees', label: 'Data Pegawai', icon: 'briefcase', group: 'Kepegawaian' },
  { key: 'teacher-subjects', label: 'Mapping Guru-Mapel', icon: 'link', group: 'Kepegawaian' },

  // PPDB
  { key: 'ppdb', label: 'PPDB', icon: 'user-plus', group: 'PPDB' },

  // Akademik
  { key: 'schedules', label: 'Jadwal Pelajaran', icon: 'clock', group: 'Akademik' },
  { key: 'learning-repositories', label: 'Learning Repository', icon: 'folder', group: 'Akademik' },
  { key: 'attendance-students', label: 'Presensi Siswa', icon: 'check-square', group: 'Akademik' },
  { key: 'grades', label: 'Penilaian', icon: 'pencil', group: 'Akademik' },
  { key: 'report-cards', label: 'E-Rapor', icon: 'file-badge', group: 'Akademik' },
  { key: 'tahfidz', label: 'Tahfidz', icon: 'book-marked', group: 'Akademik' },
  { key: 'mutabaah', label: "Mutaba'ah", icon: 'list-checks', group: 'Akademik' },

  // Keuangan
  { key: 'invoices', label: 'Tagihan', icon: 'receipt', group: 'Keuangan' },
  { key: 'payments', label: 'Pembayaran', icon: 'credit-card', group: 'Keuangan' },
  { key: 'cash-transactions', label: 'Kas Masuk/Keluar', icon: 'wallet', group: 'Keuangan' },
  { key: 'accounting-journals', label: 'Jurnal Keuangan', icon: 'book-text', group: 'Keuangan' },

  // SDM
  { key: 'attendance-employees', label: 'Presensi Pegawai', icon: 'fingerprint', group: 'SDM' },
  { key: 'leave-requests', label: 'Cuti / Izin', icon: 'plane', group: 'SDM' },

  // Sarpras & Arsip
  { key: 'assets', label: 'Sarana & Prasarana', icon: 'package', group: 'Sarpras' },

  // Notifikasi
  { key: 'notifications', label: 'Notifikasi', icon: 'bell', group: 'Lainnya' },

  // Dashboard (read-only)
  { key: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', group: 'Beranda', actions: ['read'] },
];

/** Build the flat list of permission strings from the module catalog. */
export function buildPermissionCatalog(): {
  name: string;
  module: string;
  action: string;
  description: string;
}[] {
  const list: { name: string; module: string; action: string; description: string }[] = [];
  for (const m of MODULES) {
    const actions = m.actions ?? ACTIONS;
    for (const a of actions) {
      list.push({
        name: `${m.key}.${a}`,
        module: m.key,
        action: a,
        description: `${a.toUpperCase()} ${m.label}`,
      });
    }
  }
  return list;
}

const allPerms = () => buildPermissionCatalog().map((p) => p.name);

const readOnly = () => buildPermissionCatalog().filter((p) => p.action === 'read').map((p) => p.name);

// Modules a GURU may touch (full CRUD where relevant), per Business Rule #2.
const GURU_FULL_MODULES = [
  'schedules', // view (read)
  'learning-repositories',
  'attendance-students',
  'grades',
  'report-cards',
  'tahfidz',
  'mutabaah',
  'attendance-employees',
  'leave-requests',
];

const GURU_READ_MODULES = [
  'academic-calendars',
  'students', // read only — Rule #4: guru cannot edit student master data
  'subjects',
  'classes',
  'notifications',
  'dashboard',
];

function guruPermissions(): string[] {
  const perms = new Set<string>();
  for (const m of GURU_FULL_MODULES) {
    for (const a of ACTIONS) perms.add(`${m}.${a}`);
  }
  // schedules: guru only views published schedules
  perms.delete('schedules.create');
  perms.delete('schedules.update');
  perms.delete('schedules.delete');
  for (const m of GURU_READ_MODULES) perms.add(`${m}.read`);
  return [...perms];
}

/** Map default roles to their permission set. */
export const ROLE_PERMISSIONS: Record<RoleName, string[]> = {
  // Rule #1: Admin TU = full access to everything.
  ADMIN_TU: allPerms(),
  // Rule #2 & #4: limited operational access.
  GURU: guruPermissions(),
  // Rule #3: Kepala Sekolah can view all + approve report cards.
  KEPALA_SEKOLAH: [...readOnly(), 'report-cards.update'],
  // Rule #3: Yayasan can view all (monitoring only).
  YAYASAN: readOnly(),
};

export const ROLE_DISPLAY: Record<RoleName, string> = {
  ADMIN_TU: 'Admin Tata Usaha',
  GURU: 'Guru',
  KEPALA_SEKOLAH: 'Kepala Sekolah',
  YAYASAN: 'Yayasan',
};
