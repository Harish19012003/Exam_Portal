import { successResponse } from '../../../core/response.js';
import * as authService from './auth.service.js';
import * as twoFactorService from './twoFactor.service.js';
import env from '../../../config/env.js';

/**
 * Helper to set HTTP-only authentication cookies
 */
export const setAuthCookies = (res, { accessToken, refreshToken }) => {
  const cookieOptions = {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  };

  if (accessToken) {
    res.cookie('accessToken', accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000, // 15 mins
    });
  }

  if (refreshToken) {
    res.cookie('refreshToken', refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }
};

/**
 * Helper to clear HTTP-only authentication cookies
 */
export const clearAuthCookies = (res) => {
  const cookieOptions = {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  };
  res.clearCookie('accessToken', cookieOptions);
  res.clearCookie('refreshToken', cookieOptions);
};

/**
 * Login handler (Email/Password)
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    const result = await authService.login(email, password);

    if (!result.requires2FA && result.accessToken) {
      setAuthCookies(res, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
    }

    return successResponse(res, result, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh token handler
 */
export const refresh = async (req, res, next) => {
  try {
    // Read refreshToken from HTTP-only cookie first, fallback to req.body
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    
    const { accessToken, newRefreshToken, user } = await authService.refresh(refreshToken);

    setAuthCookies(res, {
      accessToken,
      refreshToken: newRefreshToken,
    });

    return successResponse(res, { accessToken, refreshToken: newRefreshToken, user }, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Logout handler
 */
export const logout = async (req, res, next) => {
  try {
    clearAuthCookies(res);
    return successResponse(res, { message: 'Logged out successfully' }, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Forgot password handler
 */
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const result = await authService.forgotPassword(email);
    return successResponse(res, result, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Reset password handler
 */
export const resetPassword = async (req, res, next) => {
  try {
    const { token, password, confirmPassword } = req.body;
    const result = await authService.resetPassword({ token, password, confirmPassword });
    return successResponse(res, result, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Send Login OTP handler
 */
export const sendOtp = async (req, res, next) => {
  try {
    const { email } = req.body;
    const result = await authService.sendLoginOtp(email);
    return successResponse(res, result, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Verify Login OTP handler
 */
export const verifyOtp = async (req, res, next) => {
  try {
    const { email, code, challengeToken } = req.body;
    const result = await authService.verifyLoginOtp({ email, code, challengeToken });

    if (!result.requires2FA && result.accessToken) {
      setAuthCookies(res, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
    }

    return successResponse(res, result, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * 2FA Setup - Generates QR code and secret
 */
export const setup2FA = async (req, res, next) => {
  try {
    const result = await twoFactorService.initiateSetup(req.user);
    return successResponse(res, result, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * 2FA Enable - Verifies code and enables 2FA
 */
export const enable2FA = async (req, res, next) => {
  try {
    const { setupToken, code } = req.body;
    const result = await twoFactorService.finalizeSetup(req.user, setupToken, code);
    return successResponse(res, result, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * 2FA Disable
 */
export const disable2FA = async (req, res, next) => {
  try {
    const { password, code } = req.body;
    const result = await twoFactorService.disable2FA(req.user, { password, code });
    return successResponse(res, result, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * 2FA Verify during login challenge
 */
export const verify2FA = async (req, res, next) => {
  try {
    const { tempToken, code } = req.body;
    const result = await twoFactorService.verifyLogin2FA(tempToken, code);

    if (result.accessToken) {
      setAuthCookies(res, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
    }

    return successResponse(res, result, 200);
  } catch (error) {
    next(error);
  }
};
