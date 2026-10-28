import { BaseRepository } from '../../../database/base.repository.js';
import { Notification } from '../../../database/entities/index.js';

export class NotificationRepository extends BaseRepository {
  constructor() {
    super(Notification, { idField: 'id' });
  }

  async findByUserId(userId, limit = 50) {
    const rows = await this.repo().find(
      { user_id: userId },
      { orderBy: { created_at: 'DESC' }, limit },
    );
    return rows.map((r) => ({
      ...this.toPlain(r),
      id: String(r.id ?? r._id),
      created_at: r.created_at,
    }));
  }

  async markAsRead(notificationId, userId) {
    const em = this.em();
    const row = await em.findOne(Notification, { id: String(notificationId), user_id: userId });
    if (!row) return false;
    em.assign(row, { is_read: true });
    await em.flush();
    return true;
  }
}

export const notificationRepository = new NotificationRepository();
