import { NextFunction, Request, Response } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ApiError } from '../common/ApiError';

type Target = 'body' | 'query' | 'params';

/**
 * Validation layer. Parses & sanitizes the chosen request part with a Zod schema
 * and replaces it with the typed result.
 */
export const validate =
  (schema: ZodSchema, target: Target = 'body') =>
  (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req[target]);
      // query/params are read-only getters in Express 5; assign defensively
      (req as unknown as Record<string, unknown>)[target] = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        next(ApiError.badRequest('Validasi gagal', details));
        return;
      }
      next(err);
    }
  };
