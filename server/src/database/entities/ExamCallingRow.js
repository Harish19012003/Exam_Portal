import { EntitySchema } from '@mikro-orm/mongodb';

export class ExamCallingRow {}

/**
 * Op/Guard Calling detail rows — separate from Center list `exam_rows`.
 * Linked to Center via center_row_id (+ date_id / slot / shift_id).
 */
export const ExamCallingRowSchema = new EntitySchema({
  class: ExamCallingRow,
  name: 'ExamCallingRow',
  collection: 'exam_calling_rows',
  properties: {
    _id: { type: 'ObjectId', primary: true },
    id: { type: 'string', serializedPrimaryKey: true },
    exam_id: { type: 'string' },
    /** Center list ExamRow.id this Calling line expands from. */
    center_row_id: { type: 'string', nullable: true },
    date_id: { type: 'string', nullable: true },
    slot: { type: 'number', nullable: true },
    shift_id: { type: 'string', nullable: true },
    /**
     * Normalized center_code for list sort (date → Center → slot).
     * Numeric codes are zero-padded so lexicographic order matches numeric order.
     */
    sort_center_code: { type: 'string', nullable: true },
    /** Stable upsert key: center×date×slot|shift|category. */
    natural_key: { type: 'string' },
    /** Soft-hide when Max Day N / shift counts drop. */
    hidden: { type: 'boolean', default: false },
    values: { type: 'json', default: {} },
    sys_created_by: { type: 'string', nullable: true },
    sys_updated_by: { type: 'string', nullable: true },
    sys_created_at: { type: 'Date', onCreate: () => new Date() },
    sys_updated_at: { type: 'Date', onCreate: () => new Date(), onUpdate: () => new Date() },
  },
  indexes: [
    { properties: ['exam_id'] },
    { properties: ['exam_id', 'hidden'] },
    { properties: ['exam_id', 'natural_key'], options: { unique: true } },
    { properties: ['exam_id', 'center_row_id', 'date_id'] },
    /** Visible Calling list: exam date → Center code → slot/designation. */
    { properties: ['exam_id', 'hidden', 'date_id', 'sort_center_code', 'slot'] },
  ],
});
