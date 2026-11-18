import { EntitySchema } from '@mikro-orm/mongodb';

export class ExamRow {}

export const ExamRowSchema = new EntitySchema({
  class: ExamRow,
  name: 'ExamRow',
  collection: 'exam_rows',
  properties: {
    _id: { type: 'ObjectId', primary: true },
    id: { type: 'string', serializedPrimaryKey: true },
    exam_id: { type: 'string' },
    /**
     * null / missing / center-list → shared center rows (Center list + Unique-import tabs).
     * 'exam-day' → Exam Day only (one row per center × date).
     */
    row_view: { type: 'string', nullable: true },
    values: { type: 'json', default: {} },
    sys_created_by: { type: 'string', nullable: true },
    sys_updated_by: { type: 'string', nullable: true },
    sys_created_at: { type: 'Date', onCreate: () => new Date() },
    sys_updated_at: { type: 'Date', onCreate: () => new Date(), onUpdate: () => new Date() },
  },
  indexes: [{ properties: ['exam_id'] }, { properties: ['exam_id', 'row_view'] }],
});
