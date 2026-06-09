import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { authenticate } from '../../middlewares/auth';
import { requirePermission } from '../../middlewares/rbac';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../common/asyncHandler';
import { success, created } from '../../common/apiResponse';
import { getPageParams, buildMeta } from '../../common/pagination';
import { writeAudit } from '../../common/audit';
import { ApiError } from '../../common/ApiError';
import { prisma } from '../../config/prisma';
import { MODULES } from '../../config/rbac';

// =============================== USERS =====================================
export const usersRouter = Router();
usersRouter.use(authenticate);

const createUserSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(1),
  isActive: z.boolean().optional(),
  employeeId: z.string().uuid().optional().nullable(),
  roleIds: z.array(z.string().uuid()).min(1, 'Minimal satu role'),
});

const userShape = {
  id: true,
  username: true,
  email: true,
  fullName: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  userRoles: { include: { role: true } },
} as const;

usersRouter.get('/', requirePermission('users.read'), asyncHandler(async (req, res) => {
  const params = getPageParams(req);
  const where: Record<string, unknown> = { deletedAt: null };
  if (params.search) {
    where.OR = [
      { username: { contains: params.search, mode: 'insensitive' } },
      { fullName: { contains: params.search, mode: 'insensitive' } },
      { email: { contains: params.search, mode: 'insensitive' } },
    ];
  }
  const [items, total] = await Promise.all([
    prisma.user.findMany({ where, select: userShape, orderBy: { createdAt: 'desc' }, skip: params.skip, take: params.limit }),
    prisma.user.count({ where }),
  ]);
  return success(res, items, 'Berhasil', 200, buildMeta(total, params));
}));

usersRouter.get('/:id', requirePermission('users.read'), asyncHandler(async (req, res) => {
  const user = await prisma.user.findFirst({ where: { id: req.params.id, deletedAt: null }, select: userShape });
  if (!user) throw ApiError.notFound('User tidak ditemukan');
  return success(res, user);
}));

usersRouter.post('/', requirePermission('users.create'), validate(createUserSchema), asyncHandler(async (req, res) => {
  const { password, roleIds, ...rest } = req.body;
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      ...rest,
      passwordHash,
      createdBy: req.user!.id,
      userRoles: { create: roleIds.map((roleId: string) => ({ roleId, createdBy: req.user!.id })) },
    },
    select: userShape,
  });
  await writeAudit({ req, action: 'CREATE', module: 'users', entityId: user.id });
  return created(res, user, 'User berhasil dibuat');
}));

usersRouter.put('/:id', requirePermission('users.update'), validate(createUserSchema.partial()), asyncHandler(async (req, res) => {
  const { password, roleIds, ...rest } = req.body;
  const data: Record<string, unknown> = { ...rest, updatedBy: req.user!.id };
  if (password) data.passwordHash = await bcrypt.hash(password, 10);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: req.params.id }, data });
    if (roleIds) {
      await tx.userRole.deleteMany({ where: { userId: req.params.id } });
      await tx.userRole.createMany({ data: roleIds.map((roleId: string) => ({ userId: req.params.id, roleId, createdBy: req.user!.id })) });
    }
  });
  const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: userShape });
  return success(res, user, 'User diperbarui');
}));

usersRouter.delete('/:id', requirePermission('users.delete'), asyncHandler(async (req, res) => {
  await prisma.user.update({ where: { id: req.params.id }, data: { deletedAt: new Date(), isActive: false, updatedBy: req.user!.id } });
  await writeAudit({ req, action: 'DELETE', module: 'users', entityId: req.params.id });
  return success(res, null, 'User dihapus');
}));

// =============================== ROLES =====================================
export const rolesRouter = Router();
rolesRouter.use(authenticate);

const roleSchema = z.object({
  name: z.string().min(2),
  displayName: z.string().min(2),
  description: z.string().optional().nullable(),
  permissionIds: z.array(z.string().uuid()).optional(),
});

rolesRouter.get('/', requirePermission('roles.read'), asyncHandler(async (req, res) => {
  const roles = await prisma.role.findMany({
    where: { deletedAt: null },
    include: { rolePermissions: { include: { permission: true } }, _count: { select: { userRoles: true } } },
    orderBy: { name: 'asc' },
  });
  return success(res, roles);
}));

rolesRouter.post('/', requirePermission('roles.create'), validate(roleSchema), asyncHandler(async (req, res) => {
  const { permissionIds, ...rest } = req.body;
  const role = await prisma.role.create({
    data: {
      ...rest,
      createdBy: req.user!.id,
      ...(permissionIds ? { rolePermissions: { create: permissionIds.map((permissionId: string) => ({ permissionId, createdBy: req.user!.id })) } } : {}),
    },
    include: { rolePermissions: { include: { permission: true } } },
  });
  await writeAudit({ req, action: 'CREATE', module: 'roles', entityId: role.id });
  return created(res, role, 'Role dibuat');
}));

rolesRouter.put('/:id', requirePermission('roles.update'), validate(roleSchema.partial()), asyncHandler(async (req, res) => {
  const { permissionIds, ...rest } = req.body;
  await prisma.$transaction(async (tx) => {
    await tx.role.update({ where: { id: req.params.id }, data: { ...rest, updatedBy: req.user!.id } });
    if (permissionIds) {
      await tx.rolePermission.deleteMany({ where: { roleId: req.params.id } });
      await tx.rolePermission.createMany({ data: permissionIds.map((permissionId: string) => ({ roleId: req.params.id, permissionId, createdBy: req.user!.id })) });
    }
  });
  const role = await prisma.role.findUnique({ where: { id: req.params.id }, include: { rolePermissions: { include: { permission: true } } } });
  return success(res, role, 'Role diperbarui');
}));

rolesRouter.delete('/:id', requirePermission('roles.delete'), asyncHandler(async (req, res) => {
  await prisma.role.update({ where: { id: req.params.id }, data: { deletedAt: new Date(), updatedBy: req.user!.id } });
  return success(res, null, 'Role dihapus');
}));

// ============================ PERMISSIONS ==================================
export const permissionsRouter = Router();
permissionsRouter.use(authenticate);

permissionsRouter.get('/', requirePermission('permissions.read'), asyncHandler(async (_req, res) => {
  const perms = await prisma.permission.findMany({ where: { deletedAt: null }, orderBy: [{ module: 'asc' }, { action: 'asc' }] });
  // grouped by module for convenient UI rendering
  const grouped: Record<string, typeof perms> = {};
  for (const p of perms) (grouped[p.module] ??= []).push(p);
  return success(res, { flat: perms, grouped });
}));

// ============================ AUDIT LOGS ===================================
export const auditLogsRouter = Router();
auditLogsRouter.use(authenticate);

auditLogsRouter.get('/', requirePermission('audit-logs.read'), asyncHandler(async (req, res) => {
  const params = getPageParams(req);
  const where: Record<string, unknown> = { deletedAt: null };
  if (req.query.module) where.module = req.query.module;
  if (req.query.action) where.action = req.query.action;
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: params.skip, take: params.limit }),
    prisma.auditLog.count({ where }),
  ]);
  return success(res, items, 'Berhasil', 200, buildMeta(total, params));
}));

// ============================ MENU / NAV ===================================
// Returns the menu the current user may see, derived from their permissions.
export const menuRouter = Router();
menuRouter.use(authenticate);

menuRouter.get('/', asyncHandler(async (req, res) => {
  const perms = new Set(req.user!.permissions);
  const menu = MODULES.filter((m) => perms.has(`${m.key}.read`)).map((m) => ({
    key: m.key,
    label: m.label,
    icon: m.icon,
    group: m.group,
    path: `/${m.key}`,
  }));
  return success(res, menu, 'Menu sesuai hak akses');
}));
