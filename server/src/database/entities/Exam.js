import { EntitySchema } from '@mikro-orm/core';

export class Exam {}

export const ExamSchema = new EntitySchema({
  class: Exam,
  name: 'Exam',
  collection: 'exams',
  properties: {
    _id: { type: 'string', primary: true },
    values: { type: 'json', default: {} },
    created_by: { type: 'string', nullable: true },
    updated_by: { type: 'string', nullable: true },
    created_at: { type: 'Date', onCreate: () => new Date() },
    updated_at: { type: 'Date', onCreate: () => new Date(), onUpdate: () => new Date() },
  },
  indexes: [{ properties: ['created_at'] }, { properties: ['created_by'] }],
});
