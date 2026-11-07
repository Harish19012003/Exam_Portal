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
    /** Legacy center-list fields (kept in sync with view_configs['center-list']). */
    fields: { type: 'json', default: [] },
    features: { type: 'json', nullable: true },
    /**
     * Per-tab column configs for the same shared center rows.
     * { [viewKey]: { fields: [], features: null | object } }
     */
    view_configs: { type: 'json', nullable: true },
    created_by: { type: 'string', nullable: true },
    created_at: { type: 'Date', onCreate: () => new Date() },
    updated_at: { type: 'Date', onCreate: () => new Date(), onUpdate: () => new Date() },
  },
});
