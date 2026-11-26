import { EntitySchema } from '@mikro-orm/mongodb';
import { DEVICE_TAB_COLLECTIONS } from '@exam-view/shared';

/**
 * Build MikroORM schemas for Device Master bio tabs:
 *   device_<name>       — flat rows (exam_id + custom field keys)
 *   device_<name>_meta  — singleton field layout / features
 */
const toPascal = (collection) =>
  String(collection || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

const makeRowSchema = ({ collection, examScoped }) => {
  const className = toPascal(collection);
  const Row = {
    [className]: class {},
  }[className];

  const properties = {
    _id: { type: 'ObjectId', primary: true },
    id: { type: 'string', serializedPrimaryKey: true },
    version: { type: 'number', default: 1 },
    created_at: { type: 'Date', onCreate: () => new Date() },
    updated_at: { type: 'Date', onCreate: () => new Date(), onUpdate: () => new Date() },
  };
  const indexes = [{ properties: ['updated_at'] }];

  if (examScoped === true) {
    properties.exam_id = { type: 'string', nullable: true };
    indexes.push({ properties: ['exam_id'] });
  }

  return {
    className,
    entityClass: Row,
    schema: new EntitySchema({
      class: Row,
      name: className,
      collection,
      properties,
      indexes,
    }),
  };
};

const makeMetaSchema = ({ collection }) => {
  const metaCollection = `${collection}_meta`;
  const className = `${toPascal(collection)}Meta`;
  const Meta = {
    [className]: class {},
  }[className];

  return {
    className,
    entityClass: Meta,
    schema: new EntitySchema({
      class: Meta,
      name: className,
      collection: metaCollection,
      properties: {
        _id: { type: 'string', primary: true },
        fields: { type: 'json', default: [] },
        features: { type: 'json', nullable: true },
        updated_by: { type: 'string', nullable: true },
        updated_at: { type: 'Date', onCreate: () => new Date(), onUpdate: () => new Date() },
      },
    }),
  };
};

const built = DEVICE_TAB_COLLECTIONS.flatMap((view) => {
  const row = makeRowSchema({
    collection: view.collection,
    examScoped: view.examScoped === true,
  });
  const meta = makeMetaSchema({ collection: view.collection });
  return [
    { tab: view.key, kind: 'row', ...row },
    { tab: view.key, kind: 'meta', ...meta },
  ];
});

export const deviceTabEntitySchemas = built.map((b) => b.schema);

export const deviceTabEntityByTab = built.reduce((acc, item) => {
  if (!acc[item.tab]) acc[item.tab] = {};
  acc[item.tab][item.kind] = item.entityClass;
  return acc;
}, {});
