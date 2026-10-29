import { successResponse } from '../../../core/response.js';
import * as userService from './user.service.js';

export const getProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await userService.getUserById(userId);
    return successResponse(res, user, 200);
  } catch (error) {
    next(error);
  }
};

const PROFILE_FIELDS = ['first_name', 'last_name', 'phone_number', 'phone', 'timezone', 'password', 'two_factor_enabled'];

export const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const body = req.body || {};
    const own = Object.fromEntries(PROFILE_FIELDS.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));
    const user = await userService.updateUser(userId, own, req.user);
    return successResponse(res, user, 200);
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req, res, next) => {
  try {
    const user = await userService.createUser(req.body, req.user);
    return successResponse(res, user, 201);
  } catch (error) {
    next(error);
  }
};

export const bulkCreateUsers = async (req, res, next) => {
  try {
    const users = req.body.users || req.body;
    const result = await userService.bulkCreateUsers(users, req.user);
    return successResponse(res, result, 201);
  } catch (error) {
    next(error);
  }
};

export const listUsers = async (req, res, next) => {
  try {
    const users = await userService.getAllUsers();
    return successResponse(res, users, 200);
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const user = await userService.updateUser(req.params.id, req.body, req.user);
    return successResponse(res, user, 200);
  } catch (error) {
    next(error);
  }
};

export const disable2FA = async (req, res, next) => {
  try {
    const user = await userService.disable2FA(req.params.id, req.user);
    return successResponse(res, user, 200);
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const result = await userService.deleteUser(req.params.id, req.user);
    return successResponse(res, result, 200);
  } catch (error) {
    next(error);
  }
};

export const transferPrimary = async (req, res, next) => {
  try {
    const result = await userService.transferPrimarySuperAdmin(req.params.id, req.user);
    return successResponse(res, result, 200);
  } catch (error) {
    next(error);
  }
};
