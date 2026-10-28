import { EntitySchema } from '@mikro-orm/core';

export class LegalDocument {}

export const LegalDocumentSchema = new EntitySchema({
  class: LegalDocument,
  name: 'LegalDocument',
  collection: 'legal_documents',
  properties: {
    _id: { type: 'string', primary: true },
    type: { type: 'string', unique: true },
    title: { type: 'string', nullable: true },
    content: { type: 'string', nullable: true },
    author_id: { type: 'string', nullable: true },
    version: { type: 'number', default: 1 },
    created_at: { type: 'Date', onCreate: () => new Date() },
    updated_at: { type: 'Date', onCreate: () => new Date(), onUpdate: () => new Date() },
  },
});
