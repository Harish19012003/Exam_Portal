import { EntitySchema } from '@mikro-orm/core';

export class DeviceMeta {}

/** Singleton document: _id always "1" */
export const DeviceMetaSchema = new EntitySchema({
  class: DeviceMeta,
  name: 'DeviceMeta',
  collection: 'device_meta',
  properties: {
    _id: { type: 'string', primary: true },
    fields: { type: 'json', default: [] },
    features: { type: 'json', nullable: true },
    /** External API the Fetch action pulls rows from (Param / legacy): { url, method, headers[], body, dataPath, mode, auth?, schedule? } */
    api_config: { type: 'json', nullable: true },
    /**
     * Per Device Master tab API configs (same token/endpoint pattern, different report `type`).
     * Shape: { [viewKey]: api_config }
     */
    api_configs: { type: 'json', nullable: true },
    /** Scheduler bookkeeping: { next_run_at, last_run_at, last_status, last_message, last_trigger } */
    api_sync_state: { type: 'json', nullable: true },
    updated_by: { type: 'string', nullable: true },
    updated_at: { type: 'Date', onCreate: () => new Date(), onUpdate: () => new Date() },
  },
});
