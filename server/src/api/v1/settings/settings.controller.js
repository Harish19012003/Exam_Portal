import { successResponse } from '../../../core/response.js';
import * as settingsService from './settings.service.js';
import { AppError } from '../../../core/errors.js';
import { ERROR_CODES } from '@exam-view/shared';

export const getExamTableConfig = async (_req, res, next) => {
  try {
    const config = await settingsService.getExamTableConfig();
    return successResponse(res, config, 200);
  } catch (error) {
    next(error);
  }
};

export const putExamTableConfig = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      throw new AppError('Invalid exam table config payload', 400, ERROR_CODES.VALIDATION_ERROR);
    }
    const config = await settingsService.saveExamTableConfig(req.body, req.user?.id);
    return successResponse(res, config, 200);
  } catch (error) {
    next(error);
  }
};

export const getTableLayout = async (req, res, next) => {
  try {
    const result = await settingsService.getTableLayout(req.params.tableId, req.user?.id);
    return successResponse(res, result, 200);
  } catch (error) {
    next(error);
  }
};

export const putUserTableLayout = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      throw new AppError('Invalid table layout payload', 400, ERROR_CODES.VALIDATION_ERROR);
    }
    const result = await settingsService.saveUserTableLayout(
      req.params.tableId,
      req.user?.id,
      req.body,
    );
    return successResponse(res, result, 200);
  } catch (error) {
    next(error);
  }
};

export const deleteUserTableLayout = async (req, res, next) => {
  try {
    const result = await settingsService.clearUserTableLayout(req.params.tableId, req.user?.id);
    return successResponse(res, result, 200);
  } catch (error) {
    next(error);
  }
};

export const putOrgTableLayoutDefault = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      throw new AppError('Invalid table layout payload', 400, ERROR_CODES.VALIDATION_ERROR);
    }
    const result = await settingsService.saveOrgTableLayoutDefault(
      req.params.tableId,
      req.user?.id,
      req.body,
    );
    return successResponse(res, result, 200);
  } catch (error) {
    next(error);
  }
};
