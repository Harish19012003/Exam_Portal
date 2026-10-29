import { EntitySchema } from '@mikro-orm/core';

export class SeqViewMeta {}

/** Singleton document: _id always "1" */
export const SeqViewMetaSchema = new EntitySchema({
  class: SeqViewMeta,
  name: 'SeqViewMeta',
  collection: 'seq_view_meta',
  properties: {
    _id: { type: 'string', primary: true },
    fields: { type: 'json', default: [] },
    features: { type: 'json', nullable: true },
    /** External API the Fetch action pulls rows from: { url, method, headers[], body, dataPath, mode } */
    api_config: { type: 'json', nullable: true },
    /** Scheduler bookkeeping: { next_run_at, last_run_at, last_status, last_message, last_trigger } */
    api_sync_state: { type: 'json', nullable: true },
    updated_by: { type: 'string', nullable: true },
    updated_at: { type: 'Date', onCreate: () => new Date(), onUpdate: () => new Date() },
  },
});
