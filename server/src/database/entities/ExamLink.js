import { EntitySchema } from '@mikro-orm/mongodb';

/**
 * Undirected link between two exams (same event / series).
 * Pair is always stored with exam_a_id < exam_b_id so each relation is unique.
 */
export class ExamLink {}

export const ExamLinkSchema = new EntitySchema({
  class: ExamLink,
  name: 'ExamLink',
  collection: 'exam_links',
  properties: {
    _id: { type: 'ObjectId', primary: true },
    id: { type: 'string', serializedPrimaryKey: true },
    exam_a_id: { type: 'string' },
    exam_b_id: { type: 'string' },
    relation: { type: 'string', default: 'related' },
    created_by: { type: 'string', nullable: true },
    created_at: { type: 'Date', onCreate: () => new Date() },
  },
  indexes: [
    { properties: ['exam_a_id', 'exam_b_id'], options: { unique: true } },
    { properties: ['exam_a_id'] },
    { properties: ['exam_b_id'] },
  ],
});
