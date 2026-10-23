import { successResponse } from '../../../core/response.js';
import * as examService from './exam.service.js';
import { AppError } from '../../../core/errors.js';
import { ERROR_CODES } from '@exam-view/shared';

export const listExams = async (_req, res, next) => {
  try {
    const exams = await examService.listExams();
    return successResponse(res, exams, 200);
  } catch (error) {
    next(error);
  }
};

export const getExam = async (req, res, next) => {
  try {
    const exam = await examService.getExam(req.params.id);
    return successResponse(res, exam, 200);
  } catch (error) {
    next(error);
  }
};

export const createExam = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      throw new AppError('Invalid exam payload', 400, ERROR_CODES.VALIDATION_ERROR);
    }
    const exam = await examService.createExam(req.body, req.user?.id);
    return successResponse(res, exam, 201);
  } catch (error) {
    next(error);
  }
};

export const updateExam = async (req, res, next) => {
  try {
    const exam = await examService.updateExam(req.params.id, req.body || {});
    return successResponse(res, exam, 200);
  } catch (error) {
    next(error);
  }
};

export const deleteExam = async (req, res, next) => {
  try {
    const result = await examService.deleteExam(req.params.id);
    return successResponse(res, result, 200);
  } catch (error) {
    next(error);
  }
};

export const importExams = async (req, res, next) => {
  try {
    const exams = Array.isArray(req.body?.exams) ? req.body.exams : req.body;
    const result = await examService.importExams(exams, req.user?.id);
    return successResponse(res, result, 200);
  } catch (error) {
    next(error);
  }
};
