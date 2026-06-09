import { Response } from 'express';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Consistent success envelope used by every endpoint. */
export function success<T>(
  res: Response,
  data: T,
  message = 'Berhasil',
  statusCode = 200,
  meta?: PaginationMeta,
) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    ...(meta ? { meta } : {}),
  });
}

export function created<T>(res: Response, data: T, message = 'Data berhasil dibuat') {
  return success(res, data, message, 201);
}
