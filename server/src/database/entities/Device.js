import { EntitySchema } from '@mikro-orm/mongodb';

/**
 * Devices are schema-less: custom field values live as top-level keys on the document
 * (e.g. `{ device_code: 'V001', status: 'Active' }`), so only the system fields are declared here.
 * Reads/writes of the custom keys go through native EntityManager calls (see device.repository.js).
 */
export class Device {}

export const DeviceSchema = new EntitySchema({
  class: Device,
  name: 'Device',
  collection: 'devices',
  properties: {
    _id: { type: 'ObjectId', primary: true },
    id: { type: 'string', serializedPrimaryKey: true },
    version: { type: 'number', default: 1 },
    created_at: { type: 'Date', onCreate: () => new Date() },
    updated_at: { type: 'Date', onCreate: () => new Date(), onUpdate: () => new Date() },
  },
  indexes: [{ properties: ['updated_at'] }],
});
