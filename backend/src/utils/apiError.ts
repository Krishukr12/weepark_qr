export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'BAD_REQUEST';

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;
  public readonly code: ErrorCode;

  constructor(statusCode: number, message: string, details?: unknown, code?: ErrorCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;
    this.code = code ?? statusToCode(statusCode);
    Object.setPrototypeOf(this, ApiError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad request', details?: unknown): ApiError {
    return new ApiError(400, message, details, 'BAD_REQUEST');
  }

  static validation(message = 'Validation failed', details?: unknown): ApiError {
    return new ApiError(400, message, details, 'VALIDATION_ERROR');
  }

  static unauthorized(message = 'Unauthorized'): ApiError {
    return new ApiError(401, message, undefined, 'UNAUTHORIZED');
  }

  static forbidden(message = 'Forbidden'): ApiError {
    return new ApiError(403, message, undefined, 'FORBIDDEN');
  }

  static notFound(message = 'Resource not found'): ApiError {
    return new ApiError(404, message, undefined, 'NOT_FOUND');
  }

  static conflict(message = 'Conflict', details?: unknown): ApiError {
    return new ApiError(409, message, details, 'CONFLICT');
  }

  static tooMany(message = 'Too many requests'): ApiError {
    return new ApiError(429, message, undefined, 'RATE_LIMITED');
  }

  static internal(message = 'Internal server error'): ApiError {
    return new ApiError(500, message, undefined, 'INTERNAL_ERROR');
  }
}

function statusToCode(status: number): ErrorCode {
  if (status === 400) return 'BAD_REQUEST';
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 429) return 'RATE_LIMITED';
  return 'INTERNAL_ERROR';
}
