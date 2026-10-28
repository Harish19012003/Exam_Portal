import { EntitySchema } from '@mikro-orm/core';

export class SystemSetting {}

export const SystemSettingSchema = new EntitySchema({
  class: SystemSetting,
  name: 'SystemSetting',
  collection: 'system_settings',
  properties: {
    _id: { type: 'string', primary: true },
    setting_key: { type: 'string', unique: true },
    setting_value: { type: 'json', nullable: true },
    description: { type: 'string', nullable: true },
    updated_by: { type: 'string', nullable: true },
    updated_at: { type: 'Date', onCreate: () => new Date(), onUpdate: () => new Date() },
  },
});
