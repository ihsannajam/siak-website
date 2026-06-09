import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ApiError } from '../common/ApiError';
import { env } from '../config/env';

/** 404 for unmatched routes. */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    message: `Route tidak ditemukan: ${req.method} ${req.originalUrl}`,
  });
}

/** Global error handler — produces the consistent error envelope. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
) {
  let statusCode = 500;
  let message = 'Terjadi kesalahan pada server';
  let details: unknown;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      statusCode = 409;
      const target = (err.meta?.target as string[])?.join(', ') ?? 'field';
      message = `Data dengan ${target} tersebut sudah ada`;
    } else if (err.code === 'P2025') {
      statusCode = 404;
      message = 'Data tidak ditemukan';
    } else {
      statusCode = 400;
      message = 'Kesalahan operasi database';
      details = env.isProd ? undefined : err.message;
    }
  } else if (
    err instanceof SyntaxError &&
    'status' in err &&
    (err as unknown as { status?: number }).status === 400 &&
    'body' in err
  ) {
    statusCode = 400;
    message = 'JSON request body tidak valid';
    details = env.isProd ? undefined : err.message;
  } else if (err instanceof Error) {
    message = env.isProd ? message : err.message;
    details = env.isProd ? undefined : err.stack;
  }

  if (statusCode >= 500) {
    // eslint-disable-next-line no-console
    console.error('[error]', err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(details ? { details } : {}),
  });
}
