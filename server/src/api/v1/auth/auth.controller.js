import { successResponse } from '../../../core/response.js';
import * as authService from './auth.service.js';

/**
 * Login handler (Email/Password)
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    const { user, accessToken, refreshToken } = await authService.login(email, password);

    return successResponse(res, { user, accessToken, refreshToken }, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh token handler
 */
export const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    const { accessToken, newRefreshToken } = await authService.refresh(refreshToken);

    return successResponse(res, { accessToken, refreshToken: newRefreshToken }, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Logout handler
 */
export const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    // TODO: Connect to authService (invalidate refresh token)
    return successResponse(res, { message: 'Logged out successfully' }, 200);
  } catch (error) {
    next(error);
  }
};
