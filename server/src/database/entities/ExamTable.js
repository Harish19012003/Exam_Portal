import { EntitySchema } from '@mikro-orm/mongodb';

export class ExamTable {}

export const ExamTableSchema = new EntitySchema({
  class: ExamTable,
  name: 'ExamTable',
  collection: 'exam_tables',
  properties: {
    _id: { type: 'ObjectId', primary: true },
    id: { type: 'string', serializedPrimaryKey: true },
    exam_id: { type: 'string', unique: true },
    fields: { type: 'json', default: [] },
    features: { type: 'json', nullable: true },
    created_by: { type: 'string', nullable: true },
    created_at: { type: 'Date', onCreate: () => new Date() },
    updated_at: { type: 'Date', onCreate: () => new Date(), onUpdate: () => new Date() },
  },
});
