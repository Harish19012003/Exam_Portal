import { getEm } from '../database/connection.js';
import { AuditLog, User } from '../database/entities/index.js';
import { logger } from '../core/logger.js';

export const auditService = {
  async logAction({
    userId,
    action,
    resourceType,
    resourceId = null,
    oldData = null,
    newData = null,
    ipAddress = null,
    userAgent = null,
  }) {
    try {
      const em = getEm();
      const entity = em.create(AuditLog, {
        user_id: userId || null,
        action,
        resource_type: resourceType,
        resource_id: resourceId != null ? String(resourceId) : null,
        old_data: oldData ?? null,
        new_data: newData ?? null,
        ip_address: ipAddress,
        user_agent: userAgent,
      });
      await em.persist(entity).flush();
      return { id: String(entity.id ?? entity._id) };
    } catch (error) {
      logger.error('Failed to write to audit log', { error: error.message, action, userId });
    }
  },

  async getResourceHistory(resourceType, resourceId) {
    const em = getEm();
    const rows = await em.find(
      AuditLog,
      { resource_type: resourceType, resource_id: String(resourceId) },
      { orderBy: { created_at: 'DESC' } },
    );
    const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
    const users = userIds.length ? await em.find(User, { _id: { $in: userIds } }) : [];
    const byId = new Map(users.map((u) => [String(u._id), u]));
    return rows.map((r) => {
      const u = byId.get(String(r.user_id || ''));
      return {
        id: String(r.id ?? r._id),
        user_id: r.user_id,
        action: r.action,
        resource_type: r.resource_type,
        resource_id: r.resource_id,
        old_data: r.old_data,
        new_data: r.new_data,
        created_at: r.created_at,
        first_name: u?.first_name || null,
        last_name: u?.last_name || null,
      };
    });
  },
};
