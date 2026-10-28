import { EntitySchema } from '@mikro-orm/mongodb';

export class UserPreference {}

export const UserPreferenceSchema = new EntitySchema({
  class: UserPreference,
  name: 'UserPreference',
  collection: 'user_preferences',
  properties: {
    _id: { type: 'ObjectId', primary: true },
    id: { type: 'string', serializedPrimaryKey: true },
    user_id: { type: 'string' },
    pref_key: { type: 'string' },
    pref_value: { type: 'json', nullable: true },
    updated_at: { type: 'Date', onCreate: () => new Date(), onUpdate: () => new Date() },
  },
  indexes: [{ properties: ['user_id', 'pref_key'], options: { unique: true } }],
});
