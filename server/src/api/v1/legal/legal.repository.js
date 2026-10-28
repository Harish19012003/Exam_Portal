import { BaseRepository } from '../../../database/base.repository.js';
import { LegalDocument } from '../../../database/entities/index.js';
import { v4 as uuidv4 } from 'uuid';

export class LegalRepository extends BaseRepository {
  constructor() {
    super(LegalDocument, { idField: '_id' });
  }

  async findByType(type) {
    const row = await this.repo().findOne({ type });
    return row
      ? {
          id: String(row._id),
          type: row.type,
          title: row.title,
          content: row.content,
          author_id: row.author_id,
          version: row.version,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }
      : null;
  }

  async upsertDocument(type, title, content, authorId) {
    const em = this.em();
    const existing = await em.findOne(LegalDocument, { type });
    if (existing) {
      em.assign(existing, {
        title,
        content,
        author_id: authorId,
        version: (existing.version || 1) + 1,
        updated_at: new Date(),
      });
      await em.flush();
      return String(existing._id);
    }
    const id = uuidv4();
    const entity = em.create(LegalDocument, {
      _id: id,
      type,
      title,
      content,
      author_id: authorId,
      version: 1,
    });
    await em.persist(entity).flush();
    return id;
  }
}

export const legalRepository = new LegalRepository();
