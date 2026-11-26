import { EntitySchema } from '@mikro-orm/mongodb';

/**
 * Device Master rows are schema-less: custom field values live as top-level keys
 * (Shift type, Shift code, Date, Shift indicate). Only the system fields are declared here.
 * Stored in the `device_param` collection, separate from any other portal data.
 * Reads/writes of the custom keys go through native EntityManager calls (see device.repository.js).
 */
export class Device {}

export const DeviceSchema = new EntitySchema({
  class: Device,
  name: 'Device',
  collection: 'device_param',
  properties: {
    _id: { type: 'ObjectId', primary: true },
    id: { type: 'string', serializedPrimaryKey: true },
    version: { type: 'number', default: 1 },
    /** Bio exam this Param row belongs to. */
    exam_id: { type: 'string', nullable: true },
    created_at: { type: 'Date', onCreate: () => new Date() },
    updated_at: { type: 'Date', onCreate: () => new Date(), onUpdate: () => new Date() },
  },
  indexes: [{ properties: ['updated_at'] }, { properties: ['exam_id'] }],
});
