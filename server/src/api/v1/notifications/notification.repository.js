import { BaseRepository } from '../../../database/base.repository.js';

export class NotificationRepository extends BaseRepository {
  constructor() {
    super('notifications');
  }

  async findByUserId(userId, limit = 50) {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `;
    const [rows] = await this.pool.query(query, [userId, limit]);
    return rows;
  }

  async markAsRead(notificationId, userId) {
    const query = `
      UPDATE ${this.tableName}
      SET is_read = TRUE
      WHERE id = ? AND user_id = ?
    `;
    const [result] = await this.pool.query(query, [notificationId, userId]);
    return result.affectedRows > 0;
  }
}
