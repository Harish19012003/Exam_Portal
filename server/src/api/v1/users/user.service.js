import { userRepository } from './user.repository.js';
import { AppError } from '../../../core/errors.js';
import { ERROR_CODES, DEFAULT_ROLE_PERMISSIONS, normalizePermissionSet } from '@exam-view/shared';
import { invalidateAccessCache } from '../../../core/access.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getOrm, getEm } from '../../../database/connection.js';
import { User, UserTag } from '../../../database/entities/index.js';
import { deleteSetting } from '../settings/settings.repository.js';

const MAX_TAGS_PER_USER = 30;

/** Parse tag names from bulk row (array or comma/semicolon/pipe string). */
const parseTagNames = (raw) => {
  if (Array.isArray(raw)) {
    return raw.map((t) => String(t || '').trim()).filter(Boolean);
  }
  return String(raw || '')
    .split(/[,;|]/)
    .map((t) => t.trim())
    .filter(Boolean);
};

/**
 * Service to handle user-related business logic.
 */

export const getUserById = async (id) => {
  const user = await userRepository.findById(id);
  if (!user) {
    throw new AppError('User not found', 404, ERROR_CODES.NOT_FOUND);
  }
  // Remove password hash before returning
  const { password_hash, ...safeUser } = user;
  safeUser.phone_number = user.phone_number || null;
  safeUser.is_primary = Boolean(user.is_primary);
  safeUser.two_factor_enabled = Boolean(user.two_factor_enabled);
  safeUser.timezone = user.timezone || 'UTC';
  safeUser.last_active_at = user.last_active_at || null;

  if (typeof safeUser.permissions === 'string') {
    try {
      safeUser.permissions = JSON.parse(safeUser.permissions);
    } catch {
      safeUser.permissions = [];
    }
  }
  if (!safeUser.permissions) {
    safeUser.permissions = DEFAULT_ROLE_PERMISSIONS[safeUser.role] || [];
  }

  return safeUser;
};

export const createUser = async (userData, creatorUser) => {
  const existingUser = await userRepository.findByEmail(userData.email);
  if (existingUser) {
    throw new AppError('Email already in use', 400, ERROR_CODES.VALIDATION_ERROR);
  }

  // Only a Super Admin can create another super_admin
  if (userData.role === 'super_admin' && creatorUser?.role !== 'super_admin') {
    throw new AppError(
      'Only a Super Admin has authority to create Super Admin accounts',
      403,
      ERROR_CODES.FORBIDDEN
    );
  }
  if (userData.role && userData.role !== 'user' && creatorUser?.role !== 'super_admin') {
    throw new AppError('Only a Super Admin can create Admin accounts. Use groups to give access.', 403, ERROR_CODES.FORBIDDEN);
  }

  const userId = uuidv4();
  const hashedPassword = await bcrypt.hash(userData.password || 'Password@123', 10);

  // Default permissions if not provided
  let userPermissions = userData.permissions;
  if (!userPermissions || !Array.isArray(userPermissions)) {
    userPermissions = DEFAULT_ROLE_PERMISSIONS[userData.role] || [];
  }

  await userRepository.create({
    id: userId,
    email: userData.email,
    password_hash: hashedPassword,
    first_name: userData.first_name,
    last_name: userData.last_name,
    phone_number: userData.phone_number || userData.phone || null,
    role: userData.role || 'user',
    status: userData.status || 'active',
    is_primary: false,
    two_factor_enabled: false, // 2FA is always initialized as false; must be self-configured by user
    timezone: userData.timezone || 'UTC',
    last_active_at: new Date(),
    permissions: JSON.stringify(userPermissions),
  });

  return await getUserById(userId);
};

export const updateUser = async (targetId, updateData, currentActor) => {
  const targetUser = await userRepository.findById(targetId);
  if (!targetUser) {
    throw new AppError('User not found', 404, ERROR_CODES.NOT_FOUND);
  }

  // If modifying the Primary Super Admin, only the Primary Super Admin themselves can edit
  if (targetUser.is_primary && (!currentActor?.is_primary || currentActor.id !== targetUser.id)) {
    throw new AppError(
      'The Primary Super Admin account is protected and can only be modified by the Primary Super Admin.',
      403,
      ERROR_CODES.FORBIDDEN
    );
  }

  // If modifying role to super_admin or editing an existing super_admin, actor must be a super_admin
  if ((updateData.role === 'super_admin' || targetUser.role === 'super_admin') && currentActor?.role !== 'super_admin') {
    throw new AppError(
      'Only a Super Admin has authority to manage Super Admin accounts and roles.',
      403,
      ERROR_CODES.FORBIDDEN
    );
  }

  // Role decides fallback access for users outside configured groups, so it is a privilege.
  if (updateData.role !== undefined && updateData.role !== targetUser.role && currentActor?.role !== 'super_admin') {
    throw new AppError('Only a Super Admin can change roles. Use groups to give access.', 403, ERROR_CODES.FORBIDDEN);
  }

  // Prevent demoting the Primary Super Admin
  if (targetUser.is_primary && updateData.role && updateData.role !== 'super_admin') {
    throw new AppError(
      'The Primary Super Admin cannot be demoted from the super_admin role.',
      400,
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  const payload = {};
  if (updateData.first_name !== undefined) payload.first_name = updateData.first_name;
  if (updateData.last_name !== undefined) payload.last_name = updateData.last_name;
  if (updateData.phone_number !== undefined) payload.phone_number = updateData.phone_number;
  if (updateData.phone !== undefined) payload.phone_number = updateData.phone;
  if (updateData.role !== undefined) payload.role = updateData.role;
  if (updateData.status !== undefined) payload.status = updateData.status;
  if (updateData.timezone !== undefined) payload.timezone = updateData.timezone;
  if (updateData.two_factor_enabled !== undefined) {
    const isEnabling = Boolean(updateData.two_factor_enabled);
    if (isEnabling && !targetUser.two_factor_enabled) {
      throw new AppError(
        'Two-Factor Authentication can only be enabled by the user themselves from their profile security settings.',
        400,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
    payload.two_factor_enabled = isEnabling ? 1 : 0;
    if (!isEnabling) {
      await deleteSetting(`user_2fa:${targetId}`);
    }
  }
  if (updateData.last_active_at !== undefined) {
    payload.last_active_at = updateData.last_active_at;
  }

  if (updateData.permissions !== undefined) {
    payload.permissions = JSON.stringify(updateData.permissions);
  } else if (updateData.role && updateData.role !== targetUser.role) {
    payload.permissions = JSON.stringify(DEFAULT_ROLE_PERMISSIONS[updateData.role] || []);
  }

  if (updateData.access_overrides !== undefined) {
    if (currentActor?.role !== 'super_admin') {
      throw new AppError('Only a Super Admin can change extra or blocked access.', 403, ERROR_CODES.FORBIDDEN);
    }
    const raw = updateData.access_overrides || {};
    payload.access_overrides = {
      grant: normalizePermissionSet(raw.grant),
      deny: normalizePermissionSet(raw.deny),
    };
  }

  if (updateData.password) {
    payload.password_hash = await bcrypt.hash(updateData.password, 10);
  }

  await userRepository.update(targetId, payload);
  invalidateAccessCache();
  return await getUserById(targetId);
};

export const disable2FA = async (targetId, currentActor) => {
  return await updateUser(targetId, { two_factor_enabled: false }, currentActor);
};

export const transferPrimarySuperAdmin = async (targetId, currentActor) => {
  if (!currentActor) {
    throw new AppError('Authentication required.', 401, ERROR_CODES.UNAUTHORIZED);
  }

  // 1. Verify actor exists and is currently Primary Super Admin in DB
  const actor = await userRepository.findById(currentActor.id);
  if (!actor || !actor.is_primary) {
    throw new AppError(
      'Only the active Primary Super Admin has authority to transfer primary status.',
      403,
      ERROR_CODES.FORBIDDEN
    );
  }

  // 2. Prevent self-transfer
  if (currentActor.id === targetId) {
    throw new AppError(
      'You are already the Primary Super Admin.',
      400,
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  // 3. Find target user
  const targetUser = await userRepository.findById(targetId);
  if (!targetUser) {
    throw new AppError('Target user not found.', 404, ERROR_CODES.NOT_FOUND);
  }

  // 4. Verify target user is a super_admin and active
  if (targetUser.role !== 'super_admin') {
    throw new AppError(
      'Primary status can only be transferred to another Super Admin account.',
      400,
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  if (targetUser.status !== 'active') {
    throw new AppError(
      'Primary status cannot be transferred to an inactive or suspended user.',
      400,
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  // 5. Transfer atomically (Mongo multi-doc transaction when supported)
  const orm = getOrm();
  await orm.em.transactional(async (em) => {
    const actorEntity = await em.findOne(User, { _id: String(currentActor.id) });
    const targetEntity = await em.findOne(User, { _id: String(targetId) });
    if (!actorEntity || !targetEntity) {
      throw new AppError('User not found during transfer.', 404, ERROR_CODES.NOT_FOUND);
    }
    em.assign(actorEntity, { is_primary: false });
    em.assign(targetEntity, { is_primary: true });
  });

  const updatedTarget = await getUserById(targetId);
  const updatedActor = await getUserById(currentActor.id);

  return {
    message: `Primary Super Admin status successfully transferred to ${updatedTarget.first_name || ''} ${updatedTarget.last_name || ''} (${updatedTarget.email}).`,
    targetUser: updatedTarget,
    actorUser: updatedActor,
  };
};

export const getAllUsers = async () => {
  const users = await userRepository.findAll();
  return users.map((u) => {
    let perms = u.permissions;
    if (typeof perms === 'string') {
      try {
        perms = JSON.parse(perms);
      } catch {
        perms = [];
      }
    }
    if (!perms) perms = DEFAULT_ROLE_PERMISSIONS[u.role] || [];
    return {
      ...u,
      phone_number: u.phone_number || null,
      is_primary: Boolean(u.is_primary),
      two_factor_enabled: Boolean(u.two_factor_enabled),
      timezone: u.timezone || 'UTC',
      permissions: perms,
    };
  });
};

const displayName = (u) =>
  `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || 'User';

/** Lightweight user rows for assignee pickers (no permissions / secrets). */
const toAssignable = (u) => ({
  id: String(u.id),
  name: displayName(u),
  email: u.email || '',
  tag_ids: Array.isArray(u.tag_ids) ? u.tag_ids.map(String) : [],
});

/**
 * Users who have at least one of `tagIds`. Empty tagIds → empty list (callers must pick tags).
 * Active users only.
 */
export const listAssignableByTags = async (tagIds = []) => {
  const wanted = [...new Set((Array.isArray(tagIds) ? tagIds : []).map(String).filter(Boolean))];
  if (wanted.length === 0) return [];
  const users = await userRepository.findAll();
  return users
    .filter((u) => {
      if (u.status && String(u.status).toLowerCase() === 'disabled') return false;
      const tags = Array.isArray(u.tag_ids) ? u.tag_ids.map(String) : [];
      return tags.some((t) => wanted.includes(t));
    })
    .map(toAssignable)
    .sort((a, b) => a.name.localeCompare(b.name));
};

/** Resolve display labels for saved assignee user ids. */
export const resolveAssignableUsers = async (ids = []) => {
  const wanted = [...new Set((Array.isArray(ids) ? ids : []).map(String).filter(Boolean))].slice(0, 500);
  if (wanted.length === 0) return {};
  const users = await userRepository.findAll();
  const out = {};
  users.forEach((u) => {
    const id = String(u.id);
    if (wanted.includes(id)) out[id] = toAssignable(u);
  });
  return out;
};

export const bulkCreateUsers = async (usersList, creatorUser) => {
  if (!Array.isArray(usersList) || usersList.length === 0) {
    throw new AppError('No users provided in bulk upload', 400, ERROR_CODES.VALIDATION_ERROR);
  }

  const results = {
    total: usersList.length,
    successCount: 0,
    failedCount: 0,
    createdUsers: [],
    errors: [],
  };

  // One tag load + one email index — avoid N lookups / N bcrypt hashes / N flushes.
  const em = getEm();
  const [allTags, existingEmailList] = await Promise.all([
    em.find(UserTag, {}),
    userRepository.listEmails(),
  ]);
  const tagByName = new Map(
    allTags.map((t) => [String(t.name || '').trim().toLowerCase(), String(t.id ?? t._id)]),
  );
  const existingEmails = new Set(existingEmailList);
  const seenEmailsInBatch = new Set();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const passwordHashCache = new Map();
  const hashPassword = async (password) => {
    const key = String(password);
    if (passwordHashCache.has(key)) return passwordHashCache.get(key);
    const hashed = await bcrypt.hash(key, 10);
    passwordHashCache.set(key, hashed);
    return hashed;
  };

  const ready = [];

  for (let index = 0; index < usersList.length; index++) {
    const raw = usersList[index];
    const rowNum = index + 1;

    const email = String(raw.email || raw.Email || '').trim().toLowerCase();
    const firstName = String(raw.first_name || raw['First Name'] || raw.firstName || '').trim();
    const lastName = String(raw.last_name || raw['Last Name'] || raw.lastName || '').trim();
    const phoneNumber = String(raw.phone_number || raw['Phone Number'] || raw.phone || raw.Phone || '').trim();
    const rawRole = String(raw.role || raw.Role || 'user').trim().toLowerCase().replace(/\s+/g, '_');
    const role = ['super_admin', 'global_admin', 'admin', 'user'].includes(rawRole) ? rawRole : 'user';
    const rawStatus = String(raw.status || raw.Status || 'active').trim().toLowerCase();
    const status = ['active', 'inactive', 'suspended'].includes(rawStatus) ? rawStatus : 'active';
    const timezone = String(raw.timezone || raw.Timezone || 'UTC').trim();
    const password = String(raw.password || raw.Password || 'Password@123').trim() || 'Password@123';

    const tagNames = parseTagNames(raw.tags ?? raw.Tags ?? raw.tag_ids ?? '');
    const unknownTags = [];
    const tagIds = [];
    for (const name of tagNames) {
      const id = tagByName.get(name.toLowerCase());
      if (!id) {
        unknownTags.push(name);
        continue;
      }
      if (!tagIds.includes(id)) tagIds.push(id);
    }

    const fail = (reason) => {
      results.failedCount++;
      results.errors.push({ row: rowNum, email: email || 'N/A', error: reason, reason });
    };

    if (unknownTags.length) {
      fail(`Unknown tag(s): ${unknownTags.join(', ')}`);
      continue;
    }
    if (tagIds.length > MAX_TAGS_PER_USER) {
      fail(`A user can have at most ${MAX_TAGS_PER_USER} tags`);
      continue;
    }
    if (!firstName) {
      fail('Missing required header: first_name');
      continue;
    }
    if (!email) {
      fail('Missing required header: email');
      continue;
    }
    if (!emailRegex.test(email)) {
      fail('Invalid email format');
      continue;
    }
    if (seenEmailsInBatch.has(email)) {
      fail('Duplicate email in uploaded CSV');
      continue;
    }
    seenEmailsInBatch.add(email);
    if (existingEmails.has(email)) {
      fail('Email already exists in database');
      continue;
    }
    if (role !== 'user' && creatorUser?.role !== 'super_admin') {
      fail('Only Super Admins can create admin or super_admin accounts');
      continue;
    }

    ready.push({
      rowNum,
      email,
      firstName,
      lastName,
      phoneNumber,
      role,
      status,
      timezone,
      password,
      tagIds,
    });
  }

  // Unique passwords only (default Password@123 → one bcrypt for the whole import).
  const uniquePasswords = [...new Set(ready.map((r) => r.password))];
  await Promise.all(uniquePasswords.map((p) => hashPassword(p)));

  const INSERT_CHUNK = 100;
  for (let i = 0; i < ready.length; i += INSERT_CHUNK) {
    const slice = ready.slice(i, i + INSERT_CHUNK);
    const payloads = slice.map((row) => {
      const userId = uuidv4();
      const perms = DEFAULT_ROLE_PERMISSIONS[row.role] || [];
      return {
        id: userId,
        email: row.email,
        password_hash: passwordHashCache.get(row.password),
        first_name: row.firstName,
        last_name: row.lastName || null,
        phone_number: row.phoneNumber || null,
        role: row.role,
        status: row.status,
        is_primary: false,
        two_factor_enabled: false,
        timezone: row.timezone || 'UTC',
        last_active_at: new Date(),
        permissions: JSON.stringify(perms),
        tag_ids: row.tagIds,
        _meta: row,
      };
    });

    try {
      const created = await userRepository.createMany(
        payloads.map(({ _meta, ...data }) => data),
      );
      created.forEach((user, idx) => {
        const meta = payloads[idx]._meta;
        existingEmails.add(meta.email);
        results.successCount++;
        results.createdUsers.push({
          id: user.id || payloads[idx].id,
          email: meta.email,
          first_name: meta.firstName,
          last_name: meta.lastName,
          phone_number: meta.phoneNumber || null,
          role: meta.role,
          status: meta.status,
          timezone: meta.timezone,
          tag_ids: meta.tagIds,
        });
      });
    } catch (err) {
      // Fall back to one-by-one so one bad row does not fail the whole chunk.
      for (const payload of payloads) {
        const { _meta: meta, ...data } = payload;
        try {
          await userRepository.create(data);
          existingEmails.add(meta.email);
          results.successCount++;
          results.createdUsers.push({
            id: data.id,
            email: meta.email,
            first_name: meta.firstName,
            last_name: meta.lastName,
            phone_number: meta.phoneNumber || null,
            role: meta.role,
            status: meta.status,
            timezone: meta.timezone,
            tag_ids: meta.tagIds,
          });
        } catch (rowErr) {
          results.failedCount++;
          results.errors.push({
            row: meta.rowNum,
            email: meta.email,
            error: rowErr.message || 'Failed to insert user',
            reason: rowErr.message || 'Failed to insert user',
          });
        }
      }
    }
  }

  if (results.successCount > 0) invalidateAccessCache();
  return results;
};

export const deleteUser = async (targetId, currentActor) => {
  const targetUser = await userRepository.findById(targetId);
  if (!targetUser) {
    throw new AppError('User not found', 404, ERROR_CODES.NOT_FOUND);
  }

  // Never allow deleting the Primary Super Admin
  if (targetUser.is_primary) {
    throw new AppError(
      'The Primary Super Admin account is protected and cannot be deleted.',
      403,
      ERROR_CODES.FORBIDDEN
    );
  }

  // Cannot delete own account
  if (currentActor?.id === targetId) {
    throw new AppError('You cannot delete your own account.', 400, ERROR_CODES.VALIDATION_ERROR);
  }

  // If target user is a super_admin, only a super_admin can delete them
  if (targetUser.role === 'super_admin' && currentActor?.role !== 'super_admin') {
    throw new AppError(
      'Only a Super Admin has authority to manage or remove Super Admin accounts.',
      403,
      ERROR_CODES.FORBIDDEN
    );
  }

  await userRepository.delete(targetId);
  invalidateAccessCache();
  return { success: true, message: 'User deleted successfully' };
};
