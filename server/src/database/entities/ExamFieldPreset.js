import { EntitySchema } from '@mikro-orm/mongodb';

export class ExamFieldPreset {}

export const ExamFieldPresetSchema = new EntitySchema({
  class: ExamFieldPreset,
  name: 'ExamFieldPreset',
  collection: 'exam_field_presets',
  properties: {
    _id: { type: 'ObjectId', primary: true },
    id: { type: 'string', serializedPrimaryKey: true },
    name: { type: 'string' },
    service_value: { type: 'string' },
    /** Exam tab this preset belongs to (center-list, mock-day, …). */
    view: { type: 'string', default: 'center-list' },
    fields: { type: 'json', default: [] },
    features: { type: 'json', nullable: true },
    /** Table layout (column order / visibility / widths / density / formats) new exam lists start with. */
    layout: { type: 'json', nullable: true },
    created_by: { type: 'string', nullable: true },
    created_at: { type: 'Date', onCreate: () => new Date() },
    updated_at: { type: 'Date', onCreate: () => new Date(), onUpdate: () => new Date() },
  },
  indexes: [
    { properties: ['service_value', 'view'], options: { unique: true } },
  ],
});
