import { BaseRepository } from '../../../database/base.repository.js';

export class LegalRepository extends BaseRepository {
  constructor() {
    super('legal_documents');
  }

  async findByType(type) {
    const query = `SELECT * FROM ${this.tableName} WHERE type = ?`;
    const [rows] = await this.pool.query(query, [type]);
    return rows[0] || null;
  }

  async upsertDocument(type, title, content, authorId) {
    const existing = await this.findByType(type);
    if (existing) {
      const query = `
        UPDATE ${this.tableName} 
        SET title = ?, content = ?, author_id = ?, version = version + 1 
        WHERE type = ?
      `;
      await this.pool.query(query, [title, content, authorId, type]);
      return existing.id;
    } else {
      const { v4: uuidv4 } = await import('uuid');
      const id = uuidv4();
      await this.create({
        id,
        type,
        title,
        content,
        author_id: authorId
      });
      return id;
    }
  }
}
