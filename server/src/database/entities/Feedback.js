import { EntitySchema } from '@mikro-orm/mongodb';

/** Bug reports and feature requests sent from the app (sidebar "Report" / Help window). */
export class Feedback {}

export const FeedbackSchema = new EntitySchema({
  class: Feedback,
  name: 'Feedback',
  collection: 'feedback',
  properties: {
    _id: { type: 'ObjectId', primary: true },
    id: { type: 'string', serializedPrimaryKey: true },
    kind: { type: 'string' }, // 'bug' | 'feature'
    title: { type: 'string' },
    description: { type: 'string' },
    steps: { type: 'string', nullable: true },
    priority: { type: 'string', default: 'medium' },
    status: { type: 'string', default: 'new' },
    admin_note: { type: 'string', nullable: true },
    page: { type: 'string', nullable: true },
    user_agent: { type: 'string', nullable: true },
    viewport: { type: 'string', nullable: true },
    reporter_id: { type: 'string' },
    reporter_name: { type: 'string', nullable: true },
    reporter_email: { type: 'string', nullable: true },
    handled_by: { type: 'string', nullable: true },
    resolved_at: { type: 'Date', nullable: true },
    created_at: { type: 'Date', onCreate: () => new Date() },
    updated_at: { type: 'Date', onCreate: () => new Date(), onUpdate: () => new Date() },
  },
  indexes: [{ properties: ['created_at'] }, { properties: ['reporter_id'] }, { properties: ['status'] }],
});
