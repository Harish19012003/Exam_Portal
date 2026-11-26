import { EntitySchema } from '@mikro-orm/core';

export class CenterCsrMatchingMeta {}

/** Singleton document: _id always "1" */
export const CenterCsrMatchingMetaSchema = new EntitySchema({
  class: CenterCsrMatchingMeta,
  name: 'CenterCsrMatchingMeta',
  collection: 'device_center_csr_matching_meta',
  properties: {
    _id: { type: 'string', primary: true },
    fields: { type: 'json', default: [] },
    features: { type: 'json', nullable: true },
    updated_by: { type: 'string', nullable: true },
    updated_at: { type: 'Date', onCreate: () => new Date(), onUpdate: () => new Date() },
  },
});
