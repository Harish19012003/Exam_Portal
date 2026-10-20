/**
 * Application Error class
 * Extends Error to include status codes and structured application error codes.
 */
export class AppError extends Error {
  /**
   * @param {string} message - Human readable error message
   * @param {number} statusCode - HTTP status code
   * @param {string} code - Structured error code from @exam-view/shared
   */
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true; // Indicates it's a known error, not a bug

    Error.captureStackTrace(this, this.constructor);
  }
}
