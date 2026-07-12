import type { Request } from 'express';
import { ApiError } from './apiError';

/** Express 5 types route params as `string | string[]`; normalize to a single string. */
export function param(req: Request, name: string): string {
  const value = req.params[name];
  const single = Array.isArray(value) ? value[0] : value;
  if (!single) throw ApiError.badRequest(`Missing route parameter: ${name}`);
  return single;
}
