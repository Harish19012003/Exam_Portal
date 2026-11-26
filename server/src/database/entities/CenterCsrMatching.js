import { EntitySchema } from '@mikro-orm/mongodb';

/**
 * Center-CSR-Matching rows in `device_center_csr_matching`.
 * The four match keys are hardcoded top-level fields (indexed for fast lookup).
 * Extra custom field values are also stored as top-level keys.
 */
export class CenterCsrMatching {}

export const CenterCsrMatchingSchema = new EntitySchema({
  class: CenterCsrMatching,
  name: 'CenterCsrMatching',
  collection: 'device_center_csr_matching',
  properties: {
    _id: { type: 'ObjectId', primary: true },
    id: { type: 'string', serializedPrimaryKey: true },
    version: { type: 'number', default: 1 },
    /** Bio exam this CSR matching set belongs to (Device Master is per exam). */
    exam_id: { type: 'string', nullable: true },
    /** Hardcoded match columns — indexed for fast CSR matching queries. */
    exam_date: { type: 'string', nullable: true },
    exam_shift: { type: 'string', nullable: true },
    center_code: { type: 'string', nullable: true },
    client_code: { type: 'string', nullable: true },
    created_at: { type: 'Date', onCreate: () => new Date() },
    updated_at: { type: 'Date', onCreate: () => new Date(), onUpdate: () => new Date() },
  },
  indexes: [
    { properties: ['updated_at'] },
    { properties: ['exam_id'] },
    { properties: ['exam_id', 'exam_date', 'exam_shift', 'center_code', 'client_code'] },
    /** Full match key: date × shift × center × client */
    { properties: ['exam_date', 'exam_shift', 'center_code', 'client_code'] },
    { properties: ['center_code'] },
    { properties: ['client_code'] },
    { properties: ['exam_date'] },
  ],
});
