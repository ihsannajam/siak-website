import { Router } from 'express';
import { createCrudRouter } from '../../common/crudRouter';
import * as s from './schemas';

/**
 * Registry of all straightforward CRUD modules. Each entry produces a router with
 * list/detail/create/update/delete + RBAC, wired through the generic factory.
 * Complex modules (students, employees, ppdb, schedules, report-cards, payments,
 * dashboards, RBAC management) live in their own module folders.
 */
export interface MountedRouter {
  path: string;
  router: Router;
}

export function buildMasterDataRouters(): MountedRouter[] {
  return [
    // ---- Master Data Institusi ----
    {
      path: '/school-profile',
      router: createCrudRouter({
        permissionKey: 'school-profile',
        modelName: 'schoolProfile',
        searchFields: ['name', 'npsn'],
        createSchema: s.schoolProfileSchema,
        updateSchema: s.schoolProfileSchema.partial(),
      }),
    },
    {
      path: '/academic-years',
      router: createCrudRouter({
        permissionKey: 'academic-years',
        modelName: 'academicYear',
        searchFields: ['name'],
        defaultSort: { name: 'desc' },
        createSchema: s.academicYearSchema,
        updateSchema: s.academicYearSchema.partial(),
      }),
    },
    {
      path: '/semesters',
      router: createCrudRouter({
        permissionKey: 'semesters',
        modelName: 'semester',
        include: { academicYear: true },
        createSchema: s.semesterSchema,
        updateSchema: s.semesterSchema.partial(),
      }),
    },
    {
      path: '/academic-calendars',
      router: createCrudRouter({
        permissionKey: 'academic-calendars',
        modelName: 'academicCalendar',
        searchFields: ['title', 'category'],
        defaultSort: { startDate: 'asc' },
        createSchema: s.academicCalendarSchema,
        updateSchema: s.academicCalendarSchema.partial(),
      }),
    },
    {
      path: '/subjects',
      router: createCrudRouter({
        permissionKey: 'subjects',
        modelName: 'subject',
        searchFields: ['code', 'name', 'category'],
        defaultSort: { code: 'asc' },
        createSchema: s.subjectSchema,
        updateSchema: s.subjectSchema.partial(),
      }),
    },
    {
      path: '/curriculums',
      router: createCrudRouter({
        permissionKey: 'curriculums',
        modelName: 'curriculum',
        searchFields: ['name', 'code'],
        createSchema: s.curriculumSchema,
        updateSchema: s.curriculumSchema.partial(),
      }),
    },
    {
      path: '/classes',
      router: createCrudRouter({
        permissionKey: 'classes',
        modelName: 'class',
        searchFields: ['name', 'gradeLevel'],
        include: { academicYear: true, homeroomTeacher: true },
        defaultSort: { name: 'asc' },
        createSchema: s.classSchema,
        updateSchema: s.classSchema.partial(),
      }),
    },
    {
      path: '/classrooms',
      router: createCrudRouter({
        permissionKey: 'classrooms',
        modelName: 'classroom',
        searchFields: ['code', 'name', 'location'],
        defaultSort: { code: 'asc' },
        createSchema: s.classroomSchema,
        updateSchema: s.classroomSchema.partial(),
      }),
    },
    {
      path: '/digital-archives',
      router: createCrudRouter({
        permissionKey: 'digital-archives',
        modelName: 'digitalArchive',
        searchFields: ['title', 'category'],
        createSchema: s.digitalArchiveSchema,
        updateSchema: s.digitalArchiveSchema.partial(),
      }),
    },

    // ---- Akademik ----
    {
      path: '/learning-repositories',
      router: createCrudRouter({
        permissionKey: 'learning-repositories',
        modelName: 'learningRepository',
        searchFields: ['title', 'docType'],
        createSchema: s.learningRepositorySchema,
        updateSchema: s.learningRepositorySchema.partial(),
      }),
    },
    {
      path: '/attendance-students',
      router: createCrudRouter({
        permissionKey: 'attendance-students',
        modelName: 'attendanceStudent',
        include: { student: true },
        defaultSort: { date: 'desc' },
        createSchema: s.attendanceStudentSchema,
        updateSchema: s.attendanceStudentSchema.partial(),
      }),
    },
    {
      path: '/tahfidz',
      router: createCrudRouter({
        permissionKey: 'tahfidz',
        modelName: 'tahfidzRecord',
        searchFields: ['surah'],
        include: { student: true },
        defaultSort: { date: 'desc' },
        createSchema: s.tahfidzSchema,
        updateSchema: s.tahfidzSchema.partial(),
      }),
    },
    {
      path: '/mutabaah',
      router: createCrudRouter({
        permissionKey: 'mutabaah',
        modelName: 'mutabaahRecord',
        searchFields: ['activity'],
        include: { student: true },
        defaultSort: { date: 'desc' },
        createSchema: s.mutabaahSchema,
        updateSchema: s.mutabaahSchema.partial(),
      }),
    },

    // ---- Kepegawaian mapping ----
    {
      path: '/teacher-subjects',
      router: createCrudRouter({
        permissionKey: 'teacher-subjects',
        modelName: 'teacherSubjectAssignment',
        include: { employee: true, subject: true },
        createSchema: s.teacherSubjectSchema,
        updateSchema: s.teacherSubjectSchema.partial(),
      }),
    },

    // ---- Keuangan ----
    {
      path: '/invoices',
      router: createCrudRouter({
        permissionKey: 'invoices',
        modelName: 'invoice',
        searchFields: ['invoiceNumber', 'description'],
        include: { student: true },
        createSchema: s.invoiceSchema,
        updateSchema: s.invoiceSchema.partial(),
      }),
    },
    {
      path: '/cash-transactions',
      router: createCrudRouter({
        permissionKey: 'cash-transactions',
        modelName: 'cashTransaction',
        searchFields: ['code', 'category', 'description'],
        defaultSort: { date: 'desc' },
        createSchema: s.cashTransactionSchema,
        updateSchema: s.cashTransactionSchema.partial(),
      }),
    },
    {
      path: '/accounting-journals',
      router: createCrudRouter({
        permissionKey: 'accounting-journals',
        modelName: 'accountingJournal',
        searchFields: ['reference', 'description'],
        defaultSort: { date: 'desc' },
        createSchema: s.accountingJournalSchema,
        updateSchema: s.accountingJournalSchema.partial(),
      }),
    },

    // ---- SDM ----
    {
      path: '/attendance-employees',
      router: createCrudRouter({
        permissionKey: 'attendance-employees',
        modelName: 'attendanceEmployee',
        include: { employee: true },
        defaultSort: { date: 'desc' },
        createSchema: s.attendanceEmployeeSchema,
        updateSchema: s.attendanceEmployeeSchema.partial(),
      }),
    },

    // ---- Sarpras ----
    {
      path: '/assets',
      router: createCrudRouter({
        permissionKey: 'assets',
        modelName: 'asset',
        searchFields: ['code', 'name', 'category', 'location'],
        defaultSort: { code: 'asc' },
        createSchema: s.assetSchema,
        updateSchema: s.assetSchema.partial(),
      }),
    },

    // ---- Notifikasi ----
    {
      path: '/notifications',
      router: createCrudRouter({
        permissionKey: 'notifications',
        modelName: 'notification',
        searchFields: ['title', 'message'],
        createSchema: s.notificationSchema,
        updateSchema: s.notificationSchema.partial(),
      }),
    },
  ];
}
