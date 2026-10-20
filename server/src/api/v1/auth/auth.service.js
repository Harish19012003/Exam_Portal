import { AppError } from '../../../core/errors.js';
import { ERROR_CODES } from '@exam-view/shared';
import { generateAccessToken, generateRefreshToken } from '../../../core/jwt.js';
import { userRepository } from '../users/user.repository.js';
import bcrypt from 'bcryptjs';

/**
 * Service to handle authentication business logic.
 */

export const login = async (email, password) => {
  const user = await userRepository.findByEmail(email);
  if (!user) {
    throw new AppError('Invalid email or password', 401, ERROR_CODES.UNAUTHORIZED);
  }

  let isMatch = false;
  if (user.password_hash && (user.password_hash.startsWith('$2a$') || user.password_hash.startsWith('$2b$'))) {
    isMatch = await bcrypt.compare(password, user.password_hash);
  } else {
    isMatch = user.password_hash === 'hashed_' + password || user.password_hash === password;
  }

  if (!isMatch) {
    throw new AppError('Invalid email or password', 401, ERROR_CODES.UNAUTHORIZED);
  }
  
  // Update last activity timestamp on login
  const now = new Date();
  await userRepository.update(user.id, { last_active_at: now });

  // Safe user without password
  const { password_hash, ...safeUser } = user;
  safeUser.is_primary = Boolean(user.is_primary);
  safeUser.two_factor_enabled = Boolean(user.two_factor_enabled);
  safeUser.timezone = user.timezone || 'UTC';
  safeUser.last_active_at = now;

  const accessToken = generateAccessToken({
    id: user.id,
    role: user.role,
    is_primary: safeUser.is_primary,
  });
  const refreshToken = generateRefreshToken({
    id: user.id,
    role: user.role,
    is_primary: safeUser.is_primary,
  });

  return { user: safeUser, accessToken, refreshToken };
};

export const refresh = async (refreshToken) => {
  // TODO: Phase 4/7 - Verify refresh token in DB or Redis against revoked list
  const payload = { id: 1, role: 'student' }; // Placeholder payload extraction
  
  const accessToken = generateAccessToken(payload);
  const newRefreshToken = generateRefreshToken(payload);

  return { accessToken, newRefreshToken };
};
