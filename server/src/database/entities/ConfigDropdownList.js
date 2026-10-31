import { EntitySchema } from '@mikro-orm/core';

export class ConfigDropdownList {}

// Settings → Config → Dropdown lists. `_id` is a string ("ddl_...") because exam fields
// reference a list by that id.
export const ConfigDropdownListSchema = new EntitySchema({
  class: ConfigDropdownList,
  name: 'ConfigDropdownList',
  collection: 'config_dropdown_lists',
  properties: {
    _id: { type: 'string', primary: true },
    name: { type: 'string' },
    name_key: { type: 'string', unique: true },
    options: { type: 'json', default: [] },
    created_by: { type: 'string', nullable: true },
    updated_by: { type: 'string', nullable: true },
    created_at: { type: 'Date', onCreate: () => new Date() },
    updated_at: { type: 'Date', onCreate: () => new Date(), onUpdate: () => new Date() },
  },
});
