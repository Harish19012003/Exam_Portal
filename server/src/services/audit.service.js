import { db } from '../database/index.js';
import { logger } from '../utils/logger.js';

export const auditService = {
  /**
   * Log an action to the audit trail
   */
  async logAction({ userId, action, resourceType, resourceId = null, oldData = null, newData = null, ipAddress = null, userAgent = null }) {
    try {
      const query = `
        INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_data, new_data, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `;
      const values = [
        userId,
        action,
        resourceType,
        resourceId,
        oldData ? JSON.stringify(oldData) : null,
        newData ? JSON.stringify(newData) : null,
        ipAddress,
        userAgent
      ];

      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      // We don't want audit logging failures to break the main application flow, so we just log the error.
      logger.error('Failed to write to audit log', { error: error.message, action, userId });
    }
  },

  /**
   * Fetch audit logs for a specific resource
   */
  async getResourceHistory(resourceType, resourceId) {
    const query = `
      SELECT a.*, u.first_name, u.last_name 
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.resource_type = $1 AND a.resource_id = $2
      ORDER BY a.created_at DESC
    `;
    const result = await db.query(query, [resourceType, resourceId]);
    return result.rows;
  }
};

