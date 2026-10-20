import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { pool } from '../../../database/connection.js';
import env from '../../../config/env.js';
import { logger } from '../../../core/logger.js';
import { AppError } from '../../../core/errors.js';
import { ERROR_CODES } from '@exam-view/shared';
import { userRepository } from '../users/user.repository.js';
import { generateAccessToken, generateRefreshToken } from '../../../core/jwt.js';

/**
 * Derives a consistent 32-byte AES key from JWT_ACCESS_SECRET
 */
const getEncryptionKey = () => {
  return crypto.createHash('sha256').update(env.JWT_ACCESS_SECRET || 'exam_portal_secret_fallback').digest();
};

/**
 * Encrypts a plaintext string with AES-256-GCM
 */
const encrypt = (plaintext) => {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return {
    ciphertext: encrypted,
    iv: iv.toString('hex'),
    tag,
  };
};

/**
 * Decrypts an AES-256-GCM ciphertext
 */
const decrypt = (encryptedObj) => {
  if (!encryptedObj || !encryptedObj.ciphertext) return null;
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(encryptedObj.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(encryptedObj.tag, 'hex'));
  let decrypted = decipher.update(encryptedObj.ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

/**
 * Helper to generate 8 random backup recovery codes (e.g. 8421-9302)
 */
const generateBackupCodes = (count = 8) => {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const part1 = crypto.randomBytes(2).toString('hex');
    const part2 = crypto.randomBytes(2).toString('hex');
    codes.push(`${part1}-${part2}`);
  }
  return codes;
};

/**
 * Hashes a backup code with SHA-256
 */
const hashBackupCode = (code) => {
  const normalized = code.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return crypto.createHash('sha256').update(normalized).digest('hex');
};

/**
 * Checks if a user has an active 2FA secret stored
 */
export const hasTwoFactorSecret = async (userId) => {
  try {
    const [rows] = await pool.query(
      'SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1',
      [`user_2fa:${userId}`]
    );
    if (!rows || rows.length === 0) return false;
    const data = typeof rows[0].setting_value === 'string' ? JSON.parse(rows[0].setting_value) : rows[0].setting_value;
    return Boolean(data && data.secret);
  } catch (err) {
    logger.error('Error checking 2FA secret for user:', err);
    return false;
  }
};

/**
 * Step 1: Initiate 2FA setup.
 * Generates an RFC 6238 TOTP secret, a QR Code data URL, backup codes,
 * and a temporary signed setupToken.
 */
export const initiateSetup = async (user) => {
  const accountEmail = user.email || 'user';
  const secret = speakeasy.generateSecret({
    length: 20,
    name: `Exam View (${accountEmail})`,
    issuer: 'Exam View',
  });

  const otpAuthUrl = secret.otpauth_url;
  const qrCodeDataUrl = await qrcode.toDataURL(otpAuthUrl, {
    width: 260,
    margin: 2,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });

  const backupCodes = generateBackupCodes(8);

  // Sign a temporary setup token valid for 15 minutes
  const setupToken = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      base32Secret: secret.base32,
      backupCodes,
      purpose: '2fa_setup_challenge',
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );

  return {
    qrCode: qrCodeDataUrl,
    secret: secret.base32,
    otpAuthUrl,
    backupCodes,
    setupToken,
  };
};

/**
 * Step 2: Finalize 2FA setup.
 * Verifies the 6-digit code provided by the user using the temporary setupToken.
 * Once verified, saves the encrypted secret into system_settings and sets two_factor_enabled = 1.
 */
export const finalizeSetup = async (user, setupToken, verificationCode) => {
  if (!setupToken || !verificationCode) {
    throw new AppError('Setup token and verification code are required', 400, ERROR_CODES.VALIDATION_ERROR);
  }

  let payload;
  try {
    payload = jwt.verify(setupToken, env.JWT_ACCESS_SECRET);
  } catch (err) {
    throw new AppError('Setup session has expired. Please restart 2FA setup.', 400, ERROR_CODES.UNAUTHORIZED);
  }

  if (payload.purpose !== '2fa_setup_challenge' || payload.userId !== user.id) {
    throw new AppError('Invalid setup verification session', 400, ERROR_CODES.UNAUTHORIZED);
  }

  const cleanCode = verificationCode.toString().trim().replace(/\s+/g, '');

  const verified = speakeasy.totp.verify({
    secret: payload.base32Secret,
    encoding: 'base32',
    token: cleanCode,
    window: 2, // +/- 60 seconds clock drift allowance
  });

  if (!verified) {
    throw new AppError('Invalid 6-digit code. Please verify the code in your authenticator app and try again.', 400, ERROR_CODES.VALIDATION_ERROR);
  }

  // Encrypt secret for storage
  const encryptedSecret = encrypt(payload.base32Secret);
  const hashedBackupCodes = (payload.backupCodes || []).map(hashBackupCode);

  const settingPayload = {
    secret: encryptedSecret,
    backupCodes: hashedBackupCodes,
    enabledAt: new Date().toISOString(),
  };

  // Save into system_settings with ON DUPLICATE KEY UPDATE
  await pool.query(
    `INSERT INTO system_settings (setting_key, setting_value, description, updated_by)
     VALUES (?, ?, 'User 2FA TOTP secret & backup codes', ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by), updated_at = NOW()`,
    [`user_2fa:${user.id}`, JSON.stringify(settingPayload), user.id]
  );

  // Update users table
  await userRepository.update(user.id, { two_factor_enabled: 1 });

  logger.info(`✅ [2FA] Authenticator 2FA enabled for user ${user.email} (${user.id})`);

  return {
    success: true,
    message: 'Two-factor authentication with authenticator app has been successfully activated.',
  };
};

/**
 * Disables 2FA for the current user.
 * Requires user password or a valid 6-digit TOTP code for safety.
 */
export const disable2FA = async (user, { password, code }) => {
  const fullUser = await userRepository.findById(user.id);
  if (!fullUser) {
    throw new AppError('User not found', 404, ERROR_CODES.NOT_FOUND);
  }

  let authorized = false;

  // Option A: verify password
  if (password) {
    if (fullUser.password_hash && (fullUser.password_hash.startsWith('$2a$') || fullUser.password_hash.startsWith('$2b$'))) {
      authorized = await bcrypt.compare(password, fullUser.password_hash);
    } else {
      authorized = fullUser.password_hash === 'hashed_' + password || fullUser.password_hash === password;
    }
  }

  // Option B: verify current TOTP code
  if (!authorized && code) {
    const [rows] = await pool.query(
      'SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1',
      [`user_2fa:${user.id}`]
    );
    if (rows && rows.length > 0) {
      const data = typeof rows[0].setting_value === 'string' ? JSON.parse(rows[0].setting_value) : rows[0].setting_value;
      if (data?.secret) {
        const plainSecret = decrypt(data.secret);
        if (plainSecret) {
          authorized = speakeasy.totp.verify({
            secret: plainSecret,
            encoding: 'base32',
            token: code.toString().trim().replace(/\s+/g, ''),
            window: 2,
          });
        }
      }
    }
  }

  if (!authorized) {
    throw new AppError('Incorrect password or 6-digit code. Verification is required to disable 2FA.', 400, ERROR_CODES.UNAUTHORIZED);
  }

  // Remove secret record
  await pool.query('DELETE FROM system_settings WHERE setting_key = ?', [`user_2fa:${user.id}`]);
  // Set two_factor_enabled to 0
  await userRepository.update(user.id, { two_factor_enabled: 0 });

  logger.info(`🔒 [2FA] Two-factor authentication disabled for user ${user.email}`);

  return {
    success: true,
    message: 'Two-factor authentication has been disabled.',
  };
};

/**
 * Verifies a 2FA code (or backup code) during login challenge.
 * Returns full JWT tokens upon successful authentication.
 */
export const verifyLogin2FA = async (tempToken, code) => {
  if (!tempToken || !code) {
    throw new AppError('Verification session and 2FA code are required', 400, ERROR_CODES.VALIDATION_ERROR);
  }

  let payload;
  try {
    payload = jwt.verify(tempToken, env.JWT_ACCESS_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError('Login session expired. Please sign in again.', 401, ERROR_CODES.UNAUTHORIZED_EXPIRED);
    }
    throw new AppError('Invalid login session. Please sign in again.', 401, ERROR_CODES.UNAUTHORIZED);
  }

  if (payload.purpose !== '2fa_login_challenge') {
    throw new AppError('Invalid token purpose', 400, ERROR_CODES.UNAUTHORIZED);
  }

  const user = await userRepository.findById(payload.id);
  if (!user || user.status !== 'active') {
    throw new AppError('Account not found or inactive', 401, ERROR_CODES.UNAUTHORIZED);
  }

  // Fetch 2FA secret from system_settings
  const [rows] = await pool.query(
    'SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1',
    [`user_2fa:${user.id}`]
  );

  if (!rows || rows.length === 0) {
    throw new AppError('Two-factor authentication secret not found. Please contact support.', 400, ERROR_CODES.BAD_REQUEST);
  }

  const data = typeof rows[0].setting_value === 'string' ? JSON.parse(rows[0].setting_value) : rows[0].setting_value;
  if (!data || !data.secret) {
    throw new AppError('Two-factor configuration corrupted.', 400, ERROR_CODES.BAD_REQUEST);
  }

  const plainSecret = decrypt(data.secret);
  if (!plainSecret) {
    throw new AppError('Failed to decrypt 2FA credentials.', 500, ERROR_CODES.SERVER_ERROR);
  }

  const cleanInput = code.toString().trim();
  const isSixDigits = /^\d{6}$/.test(cleanInput.replace(/\s+/g, ''));

  let verified = false;
  let usedBackupCode = false;

  // Try TOTP verify if 6 digits
  if (isSixDigits) {
    verified = speakeasy.totp.verify({
      secret: plainSecret,
      encoding: 'base32',
      token: cleanInput.replace(/\s+/g, ''),
      window: 2, // +/- 60 seconds
    });
  }

  // If not verified with TOTP, check if matches one of the backup codes
  if (!verified && Array.isArray(data.backupCodes) && data.backupCodes.length > 0) {
    const inputHash = hashBackupCode(cleanInput);
    const codeIndex = data.backupCodes.indexOf(inputHash);
    if (codeIndex !== -1) {
      verified = true;
      usedBackupCode = true;
      // Consume the backup code so it cannot be reused
      data.backupCodes.splice(codeIndex, 1);
      await pool.query(
        'UPDATE system_settings SET setting_value = ?, updated_at = NOW() WHERE setting_key = ?',
        [JSON.stringify(data), `user_2fa:${user.id}`]
      );
      logger.warn(`⚠️ [2FA] User ${user.email} used a backup recovery code to log in. Remaining backup codes: ${data.backupCodes.length}`);
    }
  }

  if (!verified) {
    throw new AppError('Invalid authentication code. Please check your app and try again.', 400, ERROR_CODES.UNAUTHORIZED);
  }

  // Successful 2FA verification! Update last_active_at
  const now = new Date();
  await userRepository.update(user.id, { last_active_at: now });

  const { password_hash, ...safeUser } = user;
  safeUser.is_primary = Boolean(user.is_primary);
  safeUser.two_factor_enabled = true;
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

  logger.info(`✅ [2FA LOGIN] User ${user.email} successfully completed 2FA login (Method: ${usedBackupCode ? 'Backup Code' : 'TOTP Authenticator'})`);

  return {
    user: safeUser,
    accessToken,
    refreshToken,
    usedBackupCode,
  };
};
