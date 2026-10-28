import { EntitySchema } from '@mikro-orm/mongodb';

export class UserGroup {}

/** Admin-defined groups of portal users (shown as tabs on User Management). */
export const UserGroupSchema = new EntitySchema({
  class: UserGroup,
  name: 'UserGroup',
  collection: 'user_groups',
  properties: {
    _id: { type: 'ObjectId', primary: true },
    id: { type: 'string', serializedPrimaryKey: true },
    name: { type: 'string' },
    user_ids: { type: 'json', default: [] },
    created_by: { type: 'string', nullable: true },
    created_at: { type: 'Date', onCreate: () => new Date() },
    updated_at: { type: 'Date', onCreate: () => new Date(), onUpdate: () => new Date() },
  },
});
