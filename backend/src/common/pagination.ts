import { Request } from 'express';
import { PaginationMeta } from './apiResponse';

export interface PageParams {
  page: number;
  limit: number;
  skip: number;
  search?: string;
  sortBy?: string;
  sortOrder: 'asc' | 'desc';
}

/** Parses common list query params: ?page=1&limit=10&search=&sortBy=&sortOrder= */
export function getPageParams(req: Request): PageParams {
  const page = Math.max(parseInt((req.query.page as string) ?? '1', 10) || 1, 1);
  const limit = Math.min(
    Math.max(parseInt((req.query.limit as string) ?? '10', 10) || 10, 1),
    100,
  );
  const search = (req.query.search as string)?.trim() || undefined;
  const sortBy = (req.query.sortBy as string)?.trim() || undefined;
  const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'asc' : 'desc';

  return { page, limit, skip: (page - 1) * limit, search, sortBy, sortOrder };
}

export function buildMeta(total: number, params: PageParams): PaginationMeta {
  return {
    page: params.page,
    limit: params.limit,
    total,
    totalPages: Math.ceil(total / params.limit) || 1,
  };
}
