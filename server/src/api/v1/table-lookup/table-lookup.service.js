import { ObjectId } from '@mikro-orm/mongodb';
import { ERROR_CODES, canAction, canSeeRow, columnLevel } from '@exam-view/shared';
import { getEm } from '../../../database/connection.js';
import { AppError } from '../../../core/errors.js';
import { allSources, getSource as findSource } from './lookup-sources.js';

/**
 * Lets a field on another table read options from, and show linked values of, a row in a
 * registered table (see lookup-sources.js). Nothing is copied: the field stores the source
 * row's id and every label is read from the source on each load, so a rename there shows up
 * everywhere.
 */
const MAX_PAGE_SIZE = 50;
const MAX_SCAN = 5000; // rows examined per request when row rules force filtering in memory
const MAX_RESOLVE = 500;

const badRequest = (message) => new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR);
const forbidden = () => new AppError('You do not have access to this table', 403, ERROR_CODES.FORBIDDEN);

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getSource = (name) => {
  const source = findSource(name);
  if (!source) throw new AppError('Unknown source table', 404, ERROR_CODES.NOT_FOUND);
  return source;
};

const assertCanRead = (req, source) => {
  if (req.access?.superAdmin) return;
  if (!canAction(req.access, source.accessTable, 'view')) throw forbidden();
};

const visibleColumn = (req, source, key) =>
  req.access?.superAdmin || columnLevel(req.access, source.accessTable, key) !== 'hidden';

/** A column key must be one of the table's real fields and not hidden from this user. */
const checkedColumn = async (req, source, key, { optional = false } = {}) => {
  if (!key) {
    if (optional) return null;
    throw badRequest('column is required');
  }
  const fields = await source.listColumns();
  if (!fields.some((f) => f.key === key)) throw badRequest(`Unknown column: ${key}`);
  if (!visibleColumn(req, source, key)) throw forbidden();
  return key;
};

const rowRulesApply = (req, source) => {
  if (req.access?.superAdmin) return false;
  const t = req.access?.tables?.[source.accessTable];
  return Boolean(t?.rowScopes) || (t?.denyRowScopes?.length ?? 0) > 0;
};

const rowIsVisible = (req, source, doc) =>
  !rowRulesApply(req, source) ||
  canSeeRow(req.access, source.accessTable, { ...doc, __id: String(doc._id) }, req.me);

const text = (v) => (v === null || v === undefined ? '' : Array.isArray(v) ? v.join(', ') : String(v));

const toItem = (doc, column, detailColumn) => ({
  id: String(doc._id),
  label: column ? text(doc[column]) : '',
  detail: detailColumn ? text(doc[detailColumn]) : '',
});

/** Tables a field can read from, with the columns this user is allowed to see. */
export const listSources = async (req) => {
  const out = [];
  for (const source of allSources()) {
    if (!req.access?.superAdmin && !canAction(req.access, source.accessTable, 'view')) continue;
    const fields = await source.listColumns();
    out.push({
      table: source.key,
      label: source.label,
      columns: fields.filter((f) => visibleColumn(req, source, f.key)).map((f) => ({ key: f.key, label: f.label || f.key })),
    });
  }
  return out;
};

/** One page of rows whose `column` contains `q`, sorted by that column. */
export const searchRows = async (req, tableName, query = {}) => {
  const source = getSource(tableName);
  assertCanRead(req, source);
  const column = await checkedColumn(req, source, String(query.column || ''));
  const detailColumn = await checkedColumn(req, source, String(query.detailColumn || ''), { optional: true });
  const q = String(query.q ?? '').trim().slice(0, 100);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), MAX_PAGE_SIZE);
  const skip = Math.max(parseInt(query.skip, 10) || 0, 0);

  const match = { [column]: q ? { $regex: escapeRegex(q), $options: 'i' } : { $nin: [null, ''] } };
  const em = getEm();
  const filterInMemory = rowRulesApply(req, source);

  if (!filterInMemory) {
    const project = { [column]: 1, ...(detailColumn ? { [detailColumn]: 1 } : {}) };
    const docs = await em.aggregate(source.entity, [
      { $match: match },
      { $sort: { [column]: 1, _id: 1 } },
      { $skip: skip },
      { $limit: limit + 1 },
      { $project: project },
    ]);
    return { items: docs.slice(0, limit).map((d) => toItem(d, column, detailColumn)), hasMore: docs.length > limit };
  }

  // Row-level rules need the whole document, so page through and filter until the page is full.
  const items = [];
  let scanned = 0;
  let offset = skip;
  let exhausted = false;
  while (items.length <= limit && scanned < MAX_SCAN && !exhausted) {
    const batch = await em.aggregate(source.entity, [
      { $match: match },
      { $sort: { [column]: 1, _id: 1 } },
      { $skip: offset },
      { $limit: 200 },
    ]);
    exhausted = batch.length < 200;
    scanned += batch.length;
    offset += batch.length;
    for (const doc of batch) {
      if (rowIsVisible(req, source, doc)) items.push(toItem(doc, column, detailColumn));
    }
  }
  return { items: items.slice(0, limit), hasMore: items.length > limit };
};

const toStoredId = (source, id) => (source.idType === 'string' ? String(id) : new ObjectId(String(id)));
const isValidId = (source, id) => (source.idType === 'string' ? String(id).length > 0 : ObjectId.isValid(id));

/**
 * Current labels for saved row ids, plus any extra `columns` (for linked values) as `values`.
 * Rows that are gone or not visible are left out; columns hidden from this user are left out too.
 */
export const resolveRows = async (req, tableName, body = {}) => {
  const source = getSource(tableName);
  assertCanRead(req, source);
  const column = body.column ? await checkedColumn(req, source, String(body.column)) : null;
  const detailColumn = await checkedColumn(req, source, String(body.detailColumn || ''), { optional: true });
  const extra = [];
  for (const key of (Array.isArray(body.columns) ? body.columns : []).slice(0, 20).map(String)) {
    const known = (await source.listColumns()).some((f) => f.key === key);
    if (!known) throw badRequest(`Unknown column: ${key}`);
    if (visibleColumn(req, source, key)) extra.push(key);
  }
  if (!column && extra.length === 0) throw badRequest('column or columns is required');

  const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(String))]
    .filter((id) => isValidId(source, id))
    .slice(0, MAX_RESOLVE);
  if (ids.length === 0) return {};

  const docs = await getEm().aggregate(source.entity, [
    { $match: { _id: { $in: ids.map((id) => toStoredId(source, id)) } } },
  ]);
  const out = {};
  for (const doc of docs) {
    if (!rowIsVisible(req, source, doc)) continue;
    out[String(doc._id)] = {
      ...toItem(doc, column, detailColumn),
      values: Object.fromEntries(extra.map((key) => [key, text(doc[key])])),
    };
  }
  return out;
};
