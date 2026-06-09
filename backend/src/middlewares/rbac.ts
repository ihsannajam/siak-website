import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../common/ApiError';

/**
 * RBAC authorization. Use AFTER `authenticate`.
 *
 *  - requirePermission('students.create')         single permission
 *  - requireAnyPermission(['a.read', 'b.read'])    at least one
 *  - requireRole('ADMIN_TU')                        role-based
 */

export function requirePermission(...permissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const userPerms = req.user?.permissions ?? [];
    const ok = permissions.every((p) => userPerms.includes(p));
    if (!ok) {
      throw ApiError.forbidden(
        `Akses ditolak. Membutuhkan izin: ${permissions.join(', ')}`,
      );
    }
    next();
  };
}

export function requireAnyPermission(permissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const userPerms = req.user?.permissions ?? [];
    const ok = permissions.some((p) => userPerms.includes(p));
    if (!ok) {
      throw ApiError.forbidden(
        `Akses ditolak. Membutuhkan salah satu izin: ${permissions.join(', ')}`,
      );
    }
    next();
  };
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const userRoles = req.user?.roles ?? [];
    const ok = roles.some((r) => userRoles.includes(r));
    if (!ok) {
      throw ApiError.forbidden(`Akses ditolak. Membutuhkan role: ${roles.join(', ')}`);
    }
    next();
  };
}
