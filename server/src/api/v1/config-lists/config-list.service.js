import { randomUUID } from 'node:crypto';
import { AppError } from '../../../core/errors.js';
import { ERROR_CODES } from '@exam-view/shared';
import { auditService } from '../../../services/audit.service.js';
import * as repo from './config-list.repository.js';

const RESOURCE = 'config_dropdown_list';
const MAX_OPTIONS = 5000;

const validationError = (message) => new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR);
const notFound = () => new AppError('Dropdown list not found', 404, ERROR_CODES.NOT_FOUND);
const duplicateName = () =>
  new AppError('A dropdown list with this name already exists', 409, ERROR_CODES.CONFLICT);

const newId = () => `ddl_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
const nameKeyOf = (name) => name.toLowerCase();

const cleanOptions = (raw) => {
  if (!Array.isArray(raw)) throw validationError('options must be an array');
  const seen = new Set();
  const options = [];
  for (const o of raw) {
    const label = String(o?.label ?? '').trim();
    if (!label || label.length > 191) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const id = typeof o?.id === 'string' && /^[\w-]{1,64}$/.test(o.id) ? o.id : `opt_${randomUUID().slice(0, 8)}`;
    options.push({ id, label });
  }
  if (options.length === 0) throw validationError('Add at least one option');
  if (options.length > MAX_OPTIONS) throw validationError(`A list can have at most ${MAX_OPTIONS} options`);
  return options;
};

const cleanPayload = (body = {}) => {
  const name = String(body.name ?? '').trim();
  if (!name || name.length > 120) throw validationError('List name is required (max 120 characters)');
  return { name, nameKey: nameKeyOf(name), options: cleanOptions(body.options) };
};

const audit = (ctx, action, id, oldData, newData) =>
  auditService.logAction({
    userId: ctx.userId,
    action,
    resourceType: RESOURCE,
    resourceId: id,
    oldData,
    newData,
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  });

export const listLists = () => repo.listLists();

export const createList = async (body, ctx) => {
  const payload = cleanPayload(body);
  if (await repo.findByNameKey(payload.nameKey)) throw duplicateName();
  let id = newId();
  // Allows importing lists that already exist in a browser under their old id.
  if (typeof body.id === 'string' && /^ddl_[\w-]{1,64}$/.test(body.id) && !(await repo.findById(body.id))) {
    id = body.id;
  }
  const created = await repo.insertList({ ...payload, id, userId: ctx.userId });
  await audit(ctx, 'CREATE', id, null, created);
  return created;
};

export const updateList = async (id, body, ctx) => {
  const before = await repo.findById(id);
  if (!before) throw notFound();
  const payload = cleanPayload(body);
  const same = await repo.findByNameKey(payload.nameKey);
  if (same && same.id !== before.id) throw duplicateName();
  const updated = await repo.updateList(id, { ...payload, userId: ctx.userId });
  await audit(ctx, 'UPDATE', id, before, updated);
  return updated;
};

export const deleteList = async (id, ctx) => {
  const removed = await repo.deleteList(id);
  if (!removed) throw notFound();
  await audit(ctx, 'DELETE', id, removed, null);
  return { success: true, id: String(id) };
};

/** Bulk import: a list with the same name is replaced (keeps its id, so exam fields stay linked). */
export const bulkUpsert = async (body, ctx) => {
  const items = Array.isArray(body?.lists) ? body.lists : null;
  if (!items || items.length === 0) throw validationError('lists must be a non-empty array');
  if (items.length > 200) throw validationError('At most 200 lists per import');
  const results = [];
  for (const item of items) {
    const payload = cleanPayload(item);
    const existing = await repo.findByNameKey(payload.nameKey);
    results.push(existing ? await updateList(existing.id, item, ctx) : await createList(item, ctx));
  }
  return results;
};
