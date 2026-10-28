import { EntitySchema } from '@mikro-orm/mongodb';

/**
 * Vendors are schema-less: custom field values live as top-level keys on the document
 * (e.g. `{ vendor_code: 'V001', status: 'Active' }`), so only the system fields are declared here.
 * Reads/writes of the custom keys go through native EntityManager calls (see vendor.repository.js).
 */
export class Vendor {}

export const VendorSchema = new EntitySchema({
  class: Vendor,
  name: 'Vendor',
  collection: 'vendors',
  properties: {
    _id: { type: 'ObjectId', primary: true },
    id: { type: 'string', serializedPrimaryKey: true },
    version: { type: 'number', default: 1 },
    created_at: { type: 'Date', onCreate: () => new Date() },
    updated_at: { type: 'Date', onCreate: () => new Date(), onUpdate: () => new Date() },
  },
  indexes: [{ properties: ['updated_at'] }],
});
