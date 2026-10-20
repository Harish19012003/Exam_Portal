import { verifyAccessToken } from './jwt.js';
import { AppError } from './errors.js';
import { ERROR_CODES } from '@exam-view/shared';

/**
 * Middleware to authenticate requests based on JWT access token.
 * Token is expected in the Authorization header as: Bearer <token>
 */
export const authenticate = (req, res, next) => {
  try {
    // 1. Check HTTP-only server cookie first
    let token = req.cookies?.accessToken;

    // 2. Fallback to Authorization: Bearer <token> header
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new AppError(
        'Authentication required. Please log in.',
        401,
        ERROR_CODES.UNAUTHORIZED
      );
    }

    const decoded = verifyAccessToken(token);
    
    // Attach user payload to request
    req.user = decoded;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to restrict access based on user roles.
 * @param {string[]} allowedRoles 
 */
export const authorize = (allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user || !req.user.role) {
        throw new AppError('User role not found', 403, ERROR_CODES.FORBIDDEN);
      }

      if (!allowedRoles.includes(req.user.role)) {
        throw new AppError(
          'You do not have permission to perform this action',
          403,
          ERROR_CODES.FORBIDDEN
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export const requireAuth = authenticate;
export const requireRole = authorize;
