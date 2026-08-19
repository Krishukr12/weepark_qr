import type { CookieOptions, Request, Response } from 'express';
import { env, isProduction } from '../config/env';
import { ApiError } from './apiError';

export const REFRESH_COOKIE = 'weepark_refresh';

export function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, refreshCookieOptions());
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: 0 });
}

export function readRefreshToken(req: Request): string | undefined {
  const fromCookie = req.cookies?.[REFRESH_COOKIE];
  if (typeof fromCookie === 'string' && fromCookie.length > 0) return fromCookie;
  return undefined;
}

/** Reject cross-site POSTs that present a refresh cookie (basic CSRF guard). */
export function assertSameSiteOrigin(req: Request): void {
  const origin = req.headers.origin;
  if (!origin) return;
  const allowed = new URL(env.CLIENT_URL).origin;
  if (origin !== allowed) {
    throw ApiError.forbidden('Cross-site request rejected');
  }
}
