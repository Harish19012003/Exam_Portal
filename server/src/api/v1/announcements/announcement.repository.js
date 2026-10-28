import { BaseRepository } from '../../../database/base.repository.js';
import { Announcement, User } from '../../../database/entities/index.js';

export class AnnouncementRepository extends BaseRepository {
  constructor() {
    super(Announcement, { idField: 'id' });
  }

  async getLatestForRole(role, limit = 10) {
    const em = this.em();
    const rows = await em.find(
      Announcement,
      { $or: [{ target_role: 'ALL' }, { target_role: role }] },
      { orderBy: { created_at: 'DESC' }, limit },
    );
    const authorIds = [...new Set(rows.map((r) => r.author_id).filter(Boolean))];
    const authors = authorIds.length
      ? await em.find(User, { _id: { $in: authorIds } })
      : [];
    const byId = new Map(authors.map((u) => [String(u._id), u]));
    return rows.map((r) => {
      const author = byId.get(String(r.author_id || ''));
      return {
        ...this.toPlain(r),
        id: String(r.id ?? r._id),
        first_name: author?.first_name || null,
        last_name: author?.last_name || null,
      };
    });
  }
}

export const announcementRepository = new AnnouncementRepository();
