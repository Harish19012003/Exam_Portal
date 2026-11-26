import { EntitySchema } from '@mikro-orm/mongodb';

export class DeviceFieldPreset {}

export const DeviceFieldPresetSchema = new EntitySchema({
  class: DeviceFieldPreset,
  name: 'DeviceFieldPreset',
  collection: 'device_field_presets',
  properties: {
    _id: { type: 'ObjectId', primary: true },
    id: { type: 'string', serializedPrimaryKey: true },
    name: { type: 'string' },
    /** Device Master tab (devices, center-csr-matching, …). */
    view: { type: 'string', default: 'devices' },
    fields: { type: 'json', default: [] },
    features: { type: 'json', nullable: true },
    layout: { type: 'json', nullable: true },
    created_by: { type: 'string', nullable: true },
    created_at: { type: 'Date', onCreate: () => new Date() },
    updated_at: { type: 'Date', onCreate: () => new Date(), onUpdate: () => new Date() },
  },
  indexes: [
    { properties: ['view', 'name'], options: { unique: true } },
  ],
});
