import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { ApiError } from '../utils/apiError';
import { isProduction } from '../config/env';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

export function globalErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error: { code: err.code, message: err.message },
      details: err.details ?? undefined,
    });
    return;
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed' },
      details,
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    console.error('Prisma error', err.code);
    if (err.code === 'P2002') {
      res.status(409).json({
        success: false,
        message: 'A record with this value already exists',
        error: { code: 'CONFLICT', message: 'A record with this value already exists' },
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({
        success: false,
        message: 'Resource not found',
        error: { code: 'NOT_FOUND', message: 'Resource not found' },
      });
      return;
    }
    if (err.code === 'P2003') {
      res.status(409).json({
        success: false,
        message: 'Operation blocked by related records',
        error: { code: 'CONFLICT', message: 'Operation blocked by related records' },
      });
      return;
    }
  }

  console.error('Unhandled error:', err);
  const message = isProduction
    ? 'Internal server error'
    : err instanceof Error
      ? err.message
      : 'Internal server error';
  res.status(500).json({
    success: false,
    message,
    error: { code: 'INTERNAL_ERROR', message },
  });
}
