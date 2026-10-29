import { EntitySchema } from '@mikro-orm/mongodb';

/**
 * SeqViews are schema-less: custom field values live as top-level keys on the document
 * (e.g. `{ seq_code: 'S001', status: 'Active' }`), so only the system fields are declared here.
 * Reads/writes of the custom keys go through native EntityManager calls (see seq-view.repository.js).
 */
export class SeqView {}

export const SeqViewSchema = new EntitySchema({
  class: SeqView,
  name: 'SeqView',
  collection: 'seq_views',
  properties: {
    _id: { type: 'ObjectId', primary: true },
    id: { type: 'string', serializedPrimaryKey: true },
    version: { type: 'number', default: 1 },
    created_at: { type: 'Date', onCreate: () => new Date() },
    updated_at: { type: 'Date', onCreate: () => new Date(), onUpdate: () => new Date() },
  },
  indexes: [{ properties: ['updated_at'] }],
});
