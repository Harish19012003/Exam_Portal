import { AppError } from '../../../core/errors.js';
import { ERROR_CODES } from '@exam-view/shared';
import * as repo from './user-group.repository.js';

const MAX_GROUPS = 50;
const MAX_MEMBERS = 5000;

const validationError = (message) => new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR);
const notFound = () => new AppError('Group not found', 404, ERROR_CODES.NOT_FOUND);

const clean = (body = {}) => {
  const name = String(body.name ?? '').trim();
  if (!name || name.length > 40) throw validationError('Group name is required (max 40 characters)');
  const ids = Array.isArray(body.userIds) ? body.userIds : [];
  if (ids.length > MAX_MEMBERS) throw validationError('Too many members in one group');
  const userIds = [...new Set(ids.map((v) => String(v ?? '').trim()).filter(Boolean))];
  return { name, userIds };
};

const assertNameFree = async (name, ignoreId) => {
  const clash = (await repo.listGroups()).find(
    (g) => g.name.toLowerCase() === name.toLowerCase() && g.id !== String(ignoreId ?? ''),
  );
  if (clash) throw new AppError('A group with this name already exists', 409, ERROR_CODES.CONFLICT);
};

export const listGroups = () => repo.listGroups();

export const createGroup = async (body, actor) => {
  const data = clean(body);
  if ((await repo.listGroups()).length >= MAX_GROUPS) throw validationError(`At most ${MAX_GROUPS} groups`);
  await assertNameFree(data.name);
  return repo.create({ ...data, createdBy: actor?.id });
};

export const updateGroup = async (id, body) => {
  const data = clean(body);
  await assertNameFree(data.name, id);
  const group = await repo.update(id, data);
  if (!group) throw notFound();
  return group;
};

export const deleteGroup = async (id) => {
  if (!(await repo.findById(id))) throw notFound();
  await repo.remove(id);
  return { success: true };
};
