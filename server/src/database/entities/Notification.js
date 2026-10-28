import { EntitySchema } from '@mikro-orm/mongodb';

export class Notification {}

export const NotificationSchema = new EntitySchema({
  class: Notification,
  name: 'Notification',
  collection: 'notifications',
  properties: {
    _id: { type: 'ObjectId', primary: true },
    id: { type: 'string', serializedPrimaryKey: true },
    user_id: { type: 'string' },
    title: { type: 'string', nullable: true },
    message: { type: 'string', nullable: true },
    type: { type: 'string', nullable: true },
    is_read: { type: 'boolean', default: false },
    created_at: { type: 'Date', onCreate: () => new Date() },
  },
  indexes: [{ properties: ['user_id', 'created_at'] }],
});
