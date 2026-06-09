import { prisma } from '../config/prisma';
import { ApiError } from './ApiError';
import { PageParams } from './pagination';

/**
 * Generic repository + service layer for a Prisma model. Provides paginated list,
 * get-by-id, create, update and soft delete while consistently:
 *   - filtering out soft-deleted rows (deletedAt = null)
 *   - stamping createdBy / updatedBy audit fields
 *
 * `modelName` must match a Prisma delegate (e.g. "subject" -> prisma.subject).
 */
export interface CrudOptions {
  /** prisma delegate name, e.g. 'subject' */
  modelName: string;
  /** fields used for case-insensitive ?search= */
  searchFields?: string[];
  /** default include relations */
  include?: Record<string, unknown>;
  /** default order if no sortBy is provided */
  defaultSort?: Record<string, 'asc' | 'desc'>;
  /** hook to transform/whitelist incoming create/update data */
  transform?: (data: Record<string, unknown>) => Record<string, unknown>;
}

export class CrudService {
  private readonly delegate: any;

  constructor(private readonly options: CrudOptions) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.delegate = (prisma as any)[options.modelName];
    if (!this.delegate) {
      throw new Error(`Prisma model "${options.modelName}" tidak ditemukan`);
    }
  }

  private buildWhere(params: PageParams, extraWhere?: Record<string, unknown>) {
    const where: Record<string, unknown> = { deletedAt: null, ...extraWhere };
    if (params.search && this.options.searchFields?.length) {
      where.OR = this.options.searchFields.map((f) => ({
        [f]: { contains: params.search, mode: 'insensitive' },
      }));
    }
    return where;
  }

  async list(params: PageParams, extraWhere?: Record<string, unknown>) {
    const where = this.buildWhere(params, extraWhere);
    const orderBy = params.sortBy
      ? { [params.sortBy]: params.sortOrder }
      : this.options.defaultSort ?? { createdAt: 'desc' };

    const [items, total] = await Promise.all([
      this.delegate.findMany({
        where,
        include: this.options.include,
        orderBy,
        skip: params.skip,
        take: params.limit,
      }),
      this.delegate.count({ where }),
    ]);
    return { items, total };
  }

  async findAll(extraWhere?: Record<string, unknown>) {
    return this.delegate.findMany({
      where: { deletedAt: null, ...extraWhere },
      include: this.options.include,
      orderBy: this.options.defaultSort ?? { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    const item = await this.delegate.findFirst({
      where: { id, deletedAt: null },
      include: this.options.include,
    });
    if (!item) throw ApiError.notFound('Data tidak ditemukan');
    return item;
  }

  async create(data: Record<string, unknown>, userId?: string) {
    const payload = this.options.transform ? this.options.transform(data) : data;
    return this.delegate.create({
      data: { ...payload, createdBy: userId ?? null },
      include: this.options.include,
    });
  }

  async update(id: string, data: Record<string, unknown>, userId?: string) {
    await this.getById(id);
    const payload = this.options.transform ? this.options.transform(data) : data;
    return this.delegate.update({
      where: { id },
      data: { ...payload, updatedBy: userId ?? null },
      include: this.options.include,
    });
  }

  /** Soft delete — sets deletedAt instead of removing the row. */
  async remove(id: string, userId?: string) {
    await this.getById(id);
    return this.delegate.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: userId ?? null },
    });
  }
}
