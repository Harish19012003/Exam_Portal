import { EntitySchema } from '@mikro-orm/core';

export class UserTableMeta {}

/** Singleton document: _id always "1". Holds the Feature Builder settings of the User Management table. */
export const UserTableMetaSchema = new EntitySchema({
  class: UserTableMeta,
  name: 'UserTableMeta',
  collection: 'user_table_meta',
  properties: {
    _id: { type: 'string', primary: true },
    features: { type: 'json', nullable: true },
    updated_by: { type: 'string', nullable: true },
    updated_at: { type: 'Date', onCreate: () => new Date(), onUpdate: () => new Date() },
  },
});
