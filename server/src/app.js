/**
 * app.js — Express app setup.
 * Wires middleware, global routes, and error handler.
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import env from './config/env.js';
import { logger } from './core/logger.js';
import { errorResponse } from './core/response.js';
import { AppError } from './core/errors.js';
import { ERROR_CODES } from '@exam-view/shared';

const app = express();

// ── Security middleware ────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  })
);


// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  message: {
    success: false,
    code: ERROR_CODES.RATE_LIMITED,
    message: 'Too many requests from this IP, please try again later.',
  },
});
app.use('/api', globalLimiter);

// ── Request parsing ────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── HTTP logging ───────────────────────────────────────────────────────
if (env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// ── Health check ───────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Swagger API Docs ───────────────────────────────────────────────────
import { setupSwagger } from './docs/swagger.js';
setupSwagger(app);

// ── API routes ─────────────────────────────────────────────────────────
import apiRouter from './api/v1/index.js';
app.use('/api/v1', apiRouter);

// ── 404 handler ────────────────────────────────────────────────────────
app.use((_req, _res, next) => {
  next(new AppError('Route not found', 404, ERROR_CODES.NOT_FOUND));
});

// ── Global error handler ───────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.isOperational) {
    logger.warn(`[Operational Error] ${err.message}`, { code: err.code });
  } else {
    logger.error(`[Unhandled Error] ${err.message}`, err);
  }
  return errorResponse(res, err);
});

export default app;
