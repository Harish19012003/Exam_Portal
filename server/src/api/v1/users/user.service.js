import { userRepository } from './user.repository.js';
import { AppError } from '../../../core/errors.js';
import { ERROR_CODES, DEFAULT_ROLE_PERMISSIONS } from '@exam-view/shared';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

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
    two_factor_enabled: Boolean(userData.two_factor_enabled),
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
    payload.two_factor_enabled = updateData.two_factor_enabled ? 1 : 0;
  }
  if (updateData.last_active_at !== undefined) {
    payload.last_active_at = updateData.last_active_at;
  }

  if (updateData.permissions !== undefined) {
    payload.permissions = JSON.stringify(updateData.permissions);
  } else if (updateData.role && updateData.role !== targetUser.role) {
    payload.permissions = JSON.stringify(DEFAULT_ROLE_PERMISSIONS[updateData.role] || []);
  }

  if (updateData.password) {
    payload.password_hash = await bcrypt.hash(updateData.password, 10);
  }

  await userRepository.update(targetId, payload);
  return await getUserById(targetId);
};

export const disable2FA = async (targetId, currentActor) => {
  return await updateUser(targetId, { two_factor_enabled: false }, currentActor);
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

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const seenEmailsInBatch = new Set();

  for (let index = 0; index < usersList.length; index++) {
    const raw = usersList[index];
    const rowNum = index + 1; // 1-indexed

    // Normalize keys
    const email = String(raw.email || raw.Email || '').trim().toLowerCase();
    const firstName = String(raw.first_name || raw['First Name'] || raw.firstName || '').trim();
    const lastName = String(raw.last_name || raw['Last Name'] || raw.lastName || '').trim();
    const phoneNumber = String(raw.phone_number || raw['Phone Number'] || raw.phone || raw.Phone || '').trim();
    const rawRole = String(raw.role || raw.Role || 'user').trim().toLowerCase().replace(/\s+/g, '_');
    const role = ['super_admin', 'global_admin', 'admin', 'user'].includes(rawRole) ? rawRole : 'user';
    const rawStatus = String(raw.status || raw.Status || 'active').trim().toLowerCase();
    const status = ['active', 'inactive', 'suspended'].includes(rawStatus) ? rawStatus : 'active';
    const timezone = String(raw.timezone || raw.Timezone || 'UTC').trim();
    const password = String(raw.password || raw.Password || 'Password@123').trim();

    // Required headers validation
    if (!firstName) {
      results.failedCount++;
      results.errors.push({ row: rowNum, email: email || 'N/A', error: 'Missing required header: first_name', reason: 'Missing required header: first_name' });
      continue;
    }

    if (!email) {
      results.failedCount++;
      results.errors.push({ row: rowNum, email: 'N/A', error: 'Missing required header: email', reason: 'Missing required header: email' });
      continue;
    }

    if (!emailRegex.test(email)) {
      results.failedCount++;
      results.errors.push({ row: rowNum, email, error: 'Invalid email format', reason: 'Invalid email format' });
      continue;
    }

    if (seenEmailsInBatch.has(email)) {
      results.failedCount++;
      results.errors.push({ row: rowNum, email, error: 'Duplicate email in uploaded CSV', reason: 'Duplicate email in uploaded CSV' });
      continue;
    }
    seenEmailsInBatch.add(email);

    // Check DB email uniqueness
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      results.failedCount++;
      results.errors.push({ row: rowNum, email, error: 'Email already exists in database', reason: 'Email already exists in database' });
      continue;
    }

    // Role authority check
    if (role === 'super_admin' && creatorUser?.role !== 'super_admin') {
      results.failedCount++;
      results.errors.push({ row: rowNum, email, error: 'Only Super Admins can create super_admin role accounts', reason: 'Only Super Admins can create super_admin role accounts' });
      continue;
    }

    try {
      const userId = uuidv4();
      const hashedPassword = await bcrypt.hash(password, 10);
      const perms = DEFAULT_ROLE_PERMISSIONS[role] || [];

      await userRepository.create({
        id: userId,
        email,
        password_hash: hashedPassword,
        first_name: firstName,
        last_name: lastName || null,
        phone_number: phoneNumber || null,
        role,
        status,
        is_primary: false,
        two_factor_enabled: false,
        timezone: timezone || 'UTC',
        last_active_at: new Date(),
        permissions: JSON.stringify(perms),
      });

      results.successCount++;
      results.createdUsers.push({
        id: userId,
        email,
        first_name: firstName,
        last_name: lastName,
        phone_number: phoneNumber || null,
        role,
        status,
        timezone,
      });
    } catch (err) {
      results.failedCount++;
      results.errors.push({ row: rowNum, email, error: err.message || 'Failed to insert user', reason: err.message || 'Failed to insert user' });
    }
  }

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
  return { success: true, message: 'User deleted successfully' };
};
