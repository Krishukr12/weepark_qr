import type { Response } from 'express';
import type { PaginatedResult } from '../types';

export function sendSuccess<T>(res: Response, data: T, statusCode = 200, message?: string): Response {
  return res.status(statusCode).json({ success: true, message, data });
}

export function sendPaginated<T>(res: Response, result: PaginatedResult<T>): Response {
  return res.status(200).json({
    success: true,
    data: result.items,
    meta: result.meta,
  });
}
