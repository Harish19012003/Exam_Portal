import { EntitySchema } from '@mikro-orm/mongodb';

export class AuditLog {}

export const AuditLogSchema = new EntitySchema({
  class: AuditLog,
  name: 'AuditLog',
  collection: 'audit_logs',
  properties: {
    _id: { type: 'ObjectId', primary: true },
    id: { type: 'string', serializedPrimaryKey: true },
    user_id: { type: 'string', nullable: true },
    action: { type: 'string' },
    resource_type: { type: 'string', nullable: true },
    resource_id: { type: 'string', nullable: true },
    old_data: { type: 'json', nullable: true },
    new_data: { type: 'json', nullable: true },
    ip_address: { type: 'string', nullable: true },
    user_agent: { type: 'string', nullable: true },
    created_at: { type: 'Date', onCreate: () => new Date() },
  },
  indexes: [{ properties: ['resource_type', 'resource_id'] }],
});
