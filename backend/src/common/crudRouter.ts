import { Router } from 'express';
import { ZodSchema } from 'zod';
import { CrudService, CrudOptions } from './crudService';
import { asyncHandler } from './asyncHandler';
import { success, created } from './apiResponse';
import { getPageParams, buildMeta } from './pagination';
import { validate } from '../middlewares/validate';
import { authenticate } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import { writeAudit } from './audit';

/**
 * Builds a fully wired REST router for a module following the standard pattern:
 *   GET    /            list (paginated)
 *   GET    /:id         detail
 *   POST   /            create
 *   PUT    /:id         update
 *   DELETE /:id         soft delete
 *
 * Every route is protected by `authenticate` + the matching RBAC permission
 * (`${permissionKey}.read|create|update|delete`).
 */
export interface CrudRouterConfig extends CrudOptions {
  /** permission prefix, e.g. 'subjects' -> subjects.read etc. */
  permissionKey: string;
  createSchema?: ZodSchema;
  updateSchema?: ZodSchema;
  /** restrict list to a where clause derived from the request (e.g. by query) */
}

export function createCrudRouter(config: CrudRouterConfig): Router {
  const service = new CrudService(config);
  const router = Router();
  const p = config.permissionKey;

  router.use(authenticate);

  router.get(
    '/',
    requirePermission(`${p}.read`),
    asyncHandler(async (req, res) => {
      const params = getPageParams(req);
      // allow ?all=true to return the full list (for dropdowns)
      if (req.query.all === 'true') {
        const items = await service.findAll();
        return success(res, items);
      }
      const { items, total } = await service.list(params);
      return success(res, items, 'Berhasil', 200, buildMeta(total, params));
    }),
  );

  router.get(
    '/:id',
    requirePermission(`${p}.read`),
    asyncHandler(async (req, res) => {
      const item = await service.getById(req.params.id);
      return success(res, item);
    }),
  );

  router.post(
    '/',
    requirePermission(`${p}.create`),
    ...(config.createSchema ? [validate(config.createSchema)] : []),
    asyncHandler(async (req, res) => {
      const item = await service.create(req.body, req.user!.id);
      await writeAudit({ req, action: 'CREATE', module: p, entityId: item.id });
      return created(res, item);
    }),
  );

  router.put(
    '/:id',
    requirePermission(`${p}.update`),
    ...(config.updateSchema ? [validate(config.updateSchema)] : []),
    asyncHandler(async (req, res) => {
      const item = await service.update(req.params.id, req.body, req.user!.id);
      await writeAudit({ req, action: 'UPDATE', module: p, entityId: req.params.id });
      return success(res, item, 'Data berhasil diperbarui');
    }),
  );

  router.delete(
    '/:id',
    requirePermission(`${p}.delete`),
    asyncHandler(async (req, res) => {
      await service.remove(req.params.id, req.user!.id);
      await writeAudit({ req, action: 'DELETE', module: p, entityId: req.params.id });
      return success(res, null, 'Data berhasil dihapus');
    }),
  );

  return router;
}
