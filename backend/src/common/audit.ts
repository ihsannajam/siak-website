import { Request } from 'express';
import { prisma } from '../config/prisma';

/**
 * Writes an entry to the audit_logs table. Business Rule #9: every important
 * activity must be recorded. Fails silently so logging never breaks the request.
 */
export async function writeAudit(params: {
  req?: Request;
  userId?: string | null;
  action: string;
  module?: string;
  entityId?: string;
  detail?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId ?? params.req?.user?.id ?? null,
        action: params.action,
        module: params.module,
        entityId: params.entityId,
        detail: params.detail,
        ipAddress: params.req?.ip,
        createdBy: params.req?.user?.id ?? null,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[audit] failed to write log:', err);
  }
}
