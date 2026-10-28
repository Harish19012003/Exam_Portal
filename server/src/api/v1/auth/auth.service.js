import { AppError } from '../../../core/errors.js';
import { ERROR_CODES, forgotPasswordSchema, resetPasswordSchema, otpVerifySchema } from '@exam-view/shared';
import {
  generateAccessToken,
  generateRefreshToken,
  generateResetPasswordToken,
  verifyResetPasswordToken,
  verifyRefreshToken,
} from '../../../core/jwt.js';
import { userRepository } from '../users/user.repository.js';
import { emailService } from '../../../integrations/email.js';
import { logger } from '../../../core/logger.js';
import env from '../../../config/env.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { hasTwoFactorSecret } from './twoFactor.service.js';

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

  // If user has 2FA enabled and active TOTP secret exists, trigger 2FA challenge
  if (user.two_factor_enabled && (await hasTwoFactorSecret(user.id))) {
    const tempToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        is_primary: Boolean(user.is_primary),
        purpose: '2fa_login_challenge',
      },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '5m' }
    );

    logger.info(`🔐 [2FA CHALLENGE] Triggered 2FA challenge for user ${user.email}`);

    return {
      requires2FA: true,
      tempToken,
      email: user.email,
    };
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
  if (!refreshToken) {
    logger.warn('[AUTH REFRESH] rejected: no refresh token received (cookie missing or not sent)');
    throw new AppError('Refresh token required', 401, ERROR_CODES.UNAUTHORIZED);
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (err) {
    logger.warn(`[AUTH REFRESH] rejected: ${err.message}`);
    throw err;
  }
  if (!decoded || !decoded.id) {
    throw new AppError('Invalid refresh token', 401, ERROR_CODES.UNAUTHORIZED);
  }

  const user = await userRepository.findById(decoded.id);
  if (!user || user.status !== 'active') {
    logger.warn(`[AUTH REFRESH] rejected: user ${decoded.id} not found or inactive`);
    throw new AppError('User account not found or deactivated', 401, ERROR_CODES.UNAUTHORIZED);
  }

  const isPrimary = Boolean(user.is_primary);
  const payload = {
    id: user.id,
    role: user.role,
    is_primary: isPrimary,
  };

  const accessToken = generateAccessToken(payload);
  const newRefreshToken = generateRefreshToken(payload);

  const { password_hash, ...safeUser } = user;
  safeUser.is_primary = isPrimary;
  safeUser.two_factor_enabled = Boolean(user.two_factor_enabled);
  safeUser.timezone = user.timezone || 'UTC';

  return { accessToken, newRefreshToken, user: safeUser };
};

/**
 * Initiates forgot password flow: generates reset token and sends email
 */
export const forgotPassword = async (email) => {
  const parsed = forgotPasswordSchema.safeParse({ email });
  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message || 'Valid email required', 400, ERROR_CODES.VALIDATION_ERROR);
  }

  const user = await userRepository.findByEmail(parsed.data.email);
  const genericResponse = {
    message: 'If an account exists with that email address, a password reset link has been sent.',
  };

  // Prevent user enumeration: always return success
  if (!user) {
    return genericResponse;
  }

  // Token expires in 15m and embeds current password fingerprint to prevent replay attacks
  const resetToken = generateResetPasswordToken({
    id: user.id,
    email: user.email,
    pwh: user.password_hash ? user.password_hash.slice(-16) : 'legacy',
    purpose: 'password_reset',
  });

  const resetLink = `${env.CLIENT_URL}/reset-password?token=${encodeURIComponent(resetToken)}`;

  logger.info(`🔑 [PASSWORD RESET] Link generated for ${user.email}: ${resetLink}`);

  try {
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; color: #1e293b;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 24px;">
          <div style="width: 36px; height: 36px; background: #2563eb; color: #fff; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; text-align: center; line-height: 36px;">E</div>
          <span style="font-size: 18px; font-weight: bold; color: #0f172a; margin-left: 8px;">Exam View</span>
        </div>
        <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 12px;">Reset Your Password</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px;">
          Hello ${user.first_name || 'there'},<br />
          We received a request to reset the password for your Exam View portal account.
        </p>
        <div style="margin: 28px 0;">
          <a href="${resetLink}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; font-size: 14px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="font-size: 13px; line-height: 1.5; color: #64748b; margin: 0;">
          This link is valid for <strong>15 minutes</strong>. If you did not request a password reset, you can safely ignore this email.
        </p>
      </div>
    `;

    await emailService.sendEmail(user.email, 'Exam View - Reset Your Password', html);
  } catch (emailErr) {
    logger.warn(`Could not deliver reset email to ${user.email} (SMTP may be unconfigured): ${emailErr.message}`);
  }

  return genericResponse;
};

/**
 * Resets user password using valid token
 */
export const resetPassword = async ({ token, password, confirmPassword }) => {
  const parsed = resetPasswordSchema.safeParse({ token, password, confirmPassword });
  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message || 'Invalid reset data', 400, ERROR_CODES.VALIDATION_ERROR);
  }

  // Verify and decode token
  const payload = verifyResetPasswordToken(parsed.data.token);
  if (payload.purpose !== 'password_reset') {
    throw new AppError('Invalid token purpose', 400, ERROR_CODES.UNAUTHORIZED);
  }

  const user = await userRepository.findById(payload.id);
  if (!user) {
    throw new AppError('User account not found', 404, ERROR_CODES.NOT_FOUND);
  }

  // Verify fingerprint to guarantee the reset link can only be used once
  const currentFingerprint = user.password_hash ? user.password_hash.slice(-16) : 'legacy';
  if (currentFingerprint !== payload.pwh) {
    throw new AppError('This password reset link has already been used or has expired. Please request a new one.', 400, ERROR_CODES.UNAUTHORIZED);
  }

  // Hash new password
  const newPasswordHash = await bcrypt.hash(parsed.data.password, 10);
  await userRepository.update(user.id, { password_hash: newPasswordHash });

  logger.info(`✅ [PASSWORD RESET] Password successfully updated for user ${user.email}`);

  return { message: 'Your password has been successfully reset. You can now sign in with your new password.' };
};

/**
 * Sends a 6-digit login OTP code to user's email
 */
export const sendLoginOtp = async (email) => {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    throw new AppError('A valid email address is required', 400, ERROR_CODES.VALIDATION_ERROR);
  }

  const cleanEmail = email.trim().toLowerCase();
  const user = await userRepository.findByEmail(cleanEmail);

  if (!user) {
    throw new AppError('No account found associated with this email address.', 404, ERROR_CODES.NOT_FOUND);
  }

  if (user.status !== 'active') {
    throw new AppError('Your account is currently inactive or suspended. Please contact support.', 403, ERROR_CODES.FORBIDDEN);
  }

  // Generate a cryptographically secure 6-digit code
  const otpCode = crypto.randomInt(100000, 1000000).toString();
  const codeHash = crypto.createHash('sha256').update(otpCode).digest('hex');

  // Sign challenge token (valid for 5 minutes)
  const challengeToken = jwt.sign(
    {
      id: user.id,
      email: user.email,
      codeHash,
      purpose: 'email_otp_login',
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '5m' }
  );

  logger.info(`🔢 [LOGIN OTP] Verification code generated for ${user.email}: ${otpCode}`);

  try {
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; color: #1e293b;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 24px;">
          <div style="width: 36px; height: 36px; background: #2563eb; color: #fff; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; text-align: center; line-height: 36px;">E</div>
          <span style="font-size: 18px; font-weight: bold; color: #0f172a; margin-left: 8px;">Exam View</span>
        </div>
        <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 10px;">Your Sign-in Code</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px;">
          Hello ${user.first_name || 'there'},<br />
          Use this verification code to securely sign in to your Exam View account:
        </p>
        <div style="text-align: center; margin: 24px 0; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 10px; padding: 20px 0;">
          <span style="font-family: 'SF Mono', Consolas, Menlo, monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #2563eb;">
            ${otpCode}
          </span>
        </div>
        <p style="font-size: 13px; line-height: 1.5; color: #64748b; margin: 0;">
          This code is valid for <strong>5 minutes</strong>. If you did not request to sign in, you can safely ignore this email.
        </p>
      </div>
    `;

    await emailService.sendEmail(user.email, `Exam View Login Code: ${otpCode}`, html);
  } catch (emailErr) {
    logger.warn(`Could not send OTP email to ${user.email}: ${emailErr.message}`);
  }

  return {
    message: 'Verification code sent to your email',
    challengeToken,
  };
};

/**
 * Verifies 6-digit OTP code and logs the user in
 */
export const verifyLoginOtp = async ({ email, code, challengeToken }) => {
  const parsed = otpVerifySchema.safeParse({ code });
  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message || 'Valid 6-digit code required', 400, ERROR_CODES.VALIDATION_ERROR);
  }

  if (!challengeToken) {
    throw new AppError('Verification session expired or missing. Please request a new code.', 400, ERROR_CODES.UNAUTHORIZED);
  }

  let payload;
  try {
    payload = jwt.verify(challengeToken, env.JWT_ACCESS_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError('Verification code has expired. Please request a new one.', 400, ERROR_CODES.UNAUTHORIZED_EXPIRED);
    }
    throw new AppError('Invalid verification session. Please request a new code.', 400, ERROR_CODES.UNAUTHORIZED);
  }

  if (payload.purpose !== 'email_otp_login') {
    throw new AppError('Invalid token purpose', 400, ERROR_CODES.UNAUTHORIZED);
  }

  if (payload.email?.toLowerCase() !== email?.trim().toLowerCase()) {
    throw new AppError('Email does not match verification session', 400, ERROR_CODES.UNAUTHORIZED);
  }

  const incomingHash = crypto.createHash('sha256').update(parsed.data.code.trim()).digest('hex');
  if (incomingHash !== payload.codeHash) {
    throw new AppError('Incorrect verification code. Please check and try again.', 400, ERROR_CODES.UNAUTHORIZED);
  }

  const user = await userRepository.findById(payload.id);
  if (!user || user.status !== 'active') {
    throw new AppError('Account not found or is currently inactive', 401, ERROR_CODES.UNAUTHORIZED);
  }

  // If user has 2FA enabled and active TOTP secret exists, trigger 2FA challenge
  if (user.two_factor_enabled && (await hasTwoFactorSecret(user.id))) {
    const tempToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        is_primary: Boolean(user.is_primary),
        purpose: '2fa_login_challenge',
      },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '5m' }
    );

    logger.info(`🔐 [2FA CHALLENGE] Triggered 2FA challenge for OTP user ${user.email}`);

    return {
      requires2FA: true,
      tempToken,
      email: user.email,
    };
  }

  const now = new Date();
  await userRepository.update(user.id, { last_active_at: now });

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

  logger.info(`✅ [LOGIN OTP] User ${user.email} successfully logged in with OTP`);

  return { user: safeUser, accessToken, refreshToken };
};
