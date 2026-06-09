import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../common/ApiError';
import { verifyAccessToken } from '../common/jwt';

/**
 * Authentication middleware. Validates the Bearer access token and attaches the
 * decoded user (with roles + permissions) to req.user.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Token tidak ditemukan');
  }
  const token = header.slice(7);
  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      username: payload.username,
      fullName: payload.username,
      roles: payload.roles ?? [],
      permissions: payload.permissions ?? [],
    };
    next();
  } catch {
    throw ApiError.unauthorized('Token tidak valid atau kedaluwarsa');
  }
}
