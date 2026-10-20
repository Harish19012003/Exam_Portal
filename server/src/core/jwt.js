import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { AppError } from './errors.js';
import { ERROR_CODES } from '@exam-view/shared';

/**
 * Generates an Access Token.
 * @param {Object} payload 
 */
export const generateAccessToken = (payload) => {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  });
};

/**
 * Generates a Refresh Token.
 * @param {Object} payload 
 */
export const generateRefreshToken = (payload) => {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });
};

/**
 * Verifies an Access Token.
 * @param {string} token 
 */
export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Access token expired', 401, ERROR_CODES.UNAUTHORIZED_EXPIRED);
    }
    throw new AppError('Invalid access token', 401, ERROR_CODES.UNAUTHORIZED);
  }
};

/**
 * Verifies a Refresh Token.
 * @param {string} token 
 */
export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Refresh token expired', 401, ERROR_CODES.UNAUTHORIZED_EXPIRED);
    }
    throw new AppError('Invalid refresh token', 401, ERROR_CODES.UNAUTHORIZED);
  }
};
