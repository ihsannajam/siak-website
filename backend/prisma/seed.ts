import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  ROLES,
  ROLE_DISPLAY,
  ROLE_PERMISSIONS,
  buildPermissionCatalog,
} from '../src/config/rbac';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database SIAK An Nahl...');

  // ----- Permissions -----
  const catalog = buildPermissionCatalog();
  for (const p of catalog) {
    await prisma.permission.upsert({
      where: { name: p.name },
      update: { module: p.module, action: p.action, description: p.description },
      create: p,
    });
  }
  console.log(`  ✓ ${catalog.length} permissions`);

  const allPermissions = await prisma.permission.findMany();
  const permByName = new Map(allPermissions.map((p) => [p.name, p.id]));

  // ----- Roles + role permissions -----
  const roleIdByName: Record<string, string> = {};
  for (const roleName of Object.values(ROLES)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: { displayName: ROLE_DISPLAY[roleName] },
      create: { name: roleName, displayName: ROLE_DISPLAY[roleName] },
    });
    roleIdByName[roleName] = role.id;

    // reset & reassign permissions
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    const permNames = ROLE_PERMISSIONS[roleName];
    await prisma.rolePermission.createMany({
      data: permNames
        .filter((n) => permByName.has(n))
        .map((n) => ({ roleId: role.id, permissionId: permByName.get(n)! })),
      skipDuplicates: true,
    });
  }
  console.log('  ✓ 4 roles with permissions');

  // ----- School profile -----
  const existingSchool = await prisma.schoolProfile.findFirst();
  if (!existingSchool) {
    await prisma.schoolProfile.create({
      data: {
        name: 'RQ An Nahl',
        npsn: '12345678',
        address: 'Jl. Pendidikan No. 1',
        phone: '021-0000000',
        email: 'info@annahl.sch.id',
        headmaster: 'Ustadz Kepala Sekolah',
      },
    });
  }

  // ----- Demo employees -----
  async function ensureEmployee(fullName: string, position: string) {
    let emp = await prisma.employee.findFirst({ where: { fullName, deletedAt: null } });
    if (!emp) {
      emp = await prisma.employee.create({
        data: { fullName, position, employmentStatus: 'TETAP', gender: 'LAKI_LAKI' },
      });
    }
    return emp;
  }

  const adminEmp = await ensureEmployee('Admin Tata Usaha', 'Admin TU');
  const guruEmp = await ensureEmployee('Ustadz Guru', 'Guru Mapel');
  const kepsekEmp = await ensureEmployee('Ustadz Kepala Sekolah', 'Kepala Sekolah');
  const yayasanEmp = await ensureEmployee('Pengurus Yayasan', 'Yayasan');

  // ----- Demo users -----
  const passwordHash = await bcrypt.hash('Annahl123!', 10);

  async function ensureUser(
    username: string,
    email: string,
    fullName: string,
    roleName: string,
    employeeId?: string,
  ) {
    const user = await prisma.user.upsert({
      where: { username },
      update: { email, fullName, passwordHash, isActive: true, employeeId },
      create: { username, email, fullName, passwordHash, isActive: true, employeeId },
    });
    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: roleIdByName[roleName] } });
    return user;
  }

  await ensureUser('admin', 'admin@annahl.sch.id', 'Admin Tata Usaha', ROLES.ADMIN_TU, adminEmp.id);
  await ensureUser('guru', 'guru@annahl.sch.id', 'Ustadz Guru', ROLES.GURU, guruEmp.id);
  await ensureUser('kepsek', 'kepsek@annahl.sch.id', 'Ustadz Kepala Sekolah', ROLES.KEPALA_SEKOLAH, kepsekEmp.id);
  await ensureUser('yayasan', 'yayasan@annahl.sch.id', 'Pengurus Yayasan', ROLES.YAYASAN, yayasanEmp.id);
  console.log('  ✓ 4 demo users (admin/guru/kepsek/yayasan)');

  // ----- Academic year + semester -----
  const ay = await prisma.academicYear.upsert({
    where: { name: '2025/2026' },
    update: { isActive: true },
    create: {
      name: '2025/2026',
      startDate: new Date('2025-07-01'),
      endDate: new Date('2026-06-30'),
      isActive: true,
    },
  });
  const semCount = await prisma.semester.count({ where: { academicYearId: ay.id } });
  if (semCount === 0) {
    await prisma.semester.createMany({
      data: [
        { academicYearId: ay.id, type: 'GANJIL', isActive: true },
        { academicYearId: ay.id, type: 'GENAP', isActive: false },
      ],
    });
  }

  // ----- Subjects -----
  const subjects = [
    { code: 'PAI', name: 'Pendidikan Agama Islam', category: 'Wajib' },
    { code: 'THF', name: 'Tahfidz', category: 'Tahfidz' },
    { code: 'MTK', name: 'Matematika', category: 'Wajib' },
    { code: 'BIN', name: 'Bahasa Indonesia', category: 'Wajib' },
    { code: 'BAR', name: 'Bahasa Arab', category: 'Muatan Lokal' },
  ];
  for (const s of subjects) {
    await prisma.subject.upsert({ where: { code: s.code }, update: {}, create: s });
  }

  // ----- Classrooms + class -----
  await prisma.classroom.upsert({
    where: { code: 'R-101' },
    update: {},
    create: { code: 'R-101', name: 'Ruang 101', capacity: 30, location: 'Lantai 1' },
  });
  const classExists = await prisma.class.findFirst({ where: { name: '1A', academicYearId: ay.id } });
  if (!classExists) {
    await prisma.class.create({
      data: { name: '1A', gradeLevel: '1', academicYearId: ay.id, homeroomTeacherId: guruEmp.id, capacity: 25 },
    });
  }

  console.log('  ✓ master data starter (tahun ajaran, semester, mapel, kelas)');
  console.log('\n✅ Seeding selesai!');
  console.log('   Login: admin / guru / kepsek / yayasan  — password: Annahl123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
