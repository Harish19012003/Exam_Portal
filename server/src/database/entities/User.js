import { EntitySchema } from '@mikro-orm/core';

export class User {}

export const UserSchema = new EntitySchema({
  class: User,
  name: 'User',
  collection: 'users',
  properties: {
    _id: { type: 'string', primary: true },
    email: { type: 'string', unique: true },
    password_hash: { type: 'string' },
    first_name: { type: 'string', nullable: true },
    last_name: { type: 'string', nullable: true },
    phone_number: { type: 'string', nullable: true },
    role: { type: 'string', default: 'user' },
    status: { type: 'string', default: 'active' },
    is_primary: { type: 'boolean', default: false },
    permissions: { type: 'json', nullable: true },
    /** Per-person overrides outside groups: { grant, deny } permission sets. */
    access_overrides: { type: 'json', nullable: true },
    /** Ids of the user's tags (see UserTag). */
    tag_ids: { type: 'json', nullable: true },
    two_factor_enabled: { type: 'boolean', default: false },
    timezone: { type: 'string', default: 'UTC' },
    last_active_at: { type: 'Date', nullable: true },
    created_at: { type: 'Date', onCreate: () => new Date() },
    updated_at: { type: 'Date', onCreate: () => new Date(), onUpdate: () => new Date() },
  },
});
