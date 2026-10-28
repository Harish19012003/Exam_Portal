import { EntitySchema } from '@mikro-orm/core';

export class VendorMeta {}

/** Singleton document: _id always "1" */
export const VendorMetaSchema = new EntitySchema({
  class: VendorMeta,
  name: 'VendorMeta',
  collection: 'vendor_meta',
  properties: {
    _id: { type: 'string', primary: true },
    fields: { type: 'json', default: [] },
    features: { type: 'json', nullable: true },
    updated_by: { type: 'string', nullable: true },
    updated_at: { type: 'Date', onCreate: () => new Date(), onUpdate: () => new Date() },
  },
});
