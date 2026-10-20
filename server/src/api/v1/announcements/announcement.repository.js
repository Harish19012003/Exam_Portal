import { BaseRepository } from '../../../database/base.repository.js';

export class AnnouncementRepository extends BaseRepository {
  constructor() {
    super('announcements');
  }

  async getLatestForRole(role, limit = 10) {
    const query = `
      SELECT a.*, u.first_name, u.last_name
      FROM ${this.tableName} a
      JOIN users u ON a.author_id = u.id
      WHERE a.target_role = 'ALL' OR a.target_role = ?
      ORDER BY a.created_at DESC
      LIMIT ?
    `;
    const [rows] = await this.pool.query(query, [role, limit]);
    return rows;
  }
}
