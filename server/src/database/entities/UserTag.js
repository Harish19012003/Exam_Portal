import { EntitySchema } from '@mikro-orm/mongodb';

export class UserTag {}

/**
 * Central list of tags that can be put on portal users (labels such as an exam centre or a role in an exam).
 * Users hold tag ids in `users.tag_ids`, so renaming a tag needs no change on the users.
 */
export const UserTagSchema = new EntitySchema({
  class: UserTag,
  name: 'UserTag',
  collection: 'user_tags',
  properties: {
    _id: { type: 'ObjectId', primary: true },
    id: { type: 'string', serializedPrimaryKey: true },
    name: { type: 'string' },
    color: { type: 'string', default: '#6366f1' },
    /** Position in the admin-chosen order. Tags without one share 0 and fall back to A-Z. */
    sort_order: { type: 'number', default: 0 },
    /** Parent tag id for nested tags (e.g. ZM > RM > AM). Null = top level. */
    parent_id: { type: 'string', nullable: true },
    created_by: { type: 'string', nullable: true },
    created_at: { type: 'Date', onCreate: () => new Date() },
    updated_at: { type: 'Date', onCreate: () => new Date(), onUpdate: () => new Date() },
  },
});
