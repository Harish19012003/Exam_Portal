import { Vendor, SeqView } from '../../../database/entities/index.js';
import * as vendorFields from '../vendors/vendor-fields.repository.js';
import * as seqViewFields from '../seq-views/seq-view-fields.repository.js';

/**
 * Tables a field can read options and linked values from. To make another table available,
 * add one `register({...})` call below. Nothing else (search, resolve, linked values, the
 * pickers in the field builder) needs to change.
 *
 *   key          id used in a field's `tableSource.table`
 *   label        name shown in the pickers
 *   entity       the MikroORM entity to read (rows are documents with an `_id`)
 *   accessTable  table id for permissions: the view right, hidden columns and row rules
 *   listColumns  async () => [{ key, label }] — the columns a field may read
 *   idType       'objectId' (default) or 'string', how `_id` is stored
 */
const sources = new Map();

export const register = ({ key, label, entity, accessTable, listColumns, idType = 'objectId' }) => {
  if (!key || !entity || !accessTable || typeof listColumns !== 'function') {
    throw new Error(`Invalid lookup source: ${key || '(no key)'}`);
  }
  sources.set(key, { key, label: label || key, entity, accessTable, listColumns, idType });
};

export const getSource = (key) => sources.get(key) || null;
export const allSources = () => [...sources.values()];

register({
  key: 'vendors',
  label: 'Vendors',
  entity: Vendor,
  accessTable: 'vendors',
  listColumns: () => vendorFields.listFields(),
});

register({
  key: 'seq_views',
  label: 'SeqView',
  entity: SeqView,
  accessTable: 'seq_views',
  listColumns: () => seqViewFields.listFields(),
});
