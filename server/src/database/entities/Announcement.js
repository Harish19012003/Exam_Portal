import { EntitySchema } from '@mikro-orm/mongodb';

export class Announcement {}

export const AnnouncementSchema = new EntitySchema({
  class: Announcement,
  name: 'Announcement',
  collection: 'announcements',
  properties: {
    _id: { type: 'ObjectId', primary: true },
    id: { type: 'string', serializedPrimaryKey: true },
    title: { type: 'string', nullable: true },
    content: { type: 'string', nullable: true },
    author_id: { type: 'string', nullable: true },
    target_role: { type: 'string', default: 'ALL' },
    created_at: { type: 'Date', onCreate: () => new Date() },
  },
  indexes: [{ properties: ['created_at'] }],
});
