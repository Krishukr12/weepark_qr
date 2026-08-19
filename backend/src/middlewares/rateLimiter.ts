import rateLimit, { type Options } from 'express-rate-limit';
import { env, isTest } from '../config/env';

/**
 * Memory store by default. Swap `store` for a Redis-backed store
 * (e.g. `rate-limit-redis`) when running multiple API instances.
 */
function createLimiter(options: Partial<Options> & Pick<Options, 'windowMs' | 'max' | 'message'>) {
  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTest,
    ...options,
  });
}

export const apiLimiter = createLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  message: { success: false, message: 'Too many requests, please try again later', error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
});

export const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many authentication attempts, please try again later', error: { code: 'RATE_LIMITED', message: 'Too many authentication attempts' } },
});

export const refreshLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, message: 'Too many token refresh attempts', error: { code: 'RATE_LIMITED', message: 'Too many token refresh attempts' } },
});

export const publicLookupLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many vehicle lookups, please try again later', error: { code: 'RATE_LIMITED', message: 'Too many vehicle lookups' } },
});

export const publicRegisterLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: { success: false, message: 'Too many registrations, please try again later', error: { code: 'RATE_LIMITED', message: 'Too many registrations' } },
});

export const publicParkLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many parking requests, please try again later', error: { code: 'RATE_LIMITED', message: 'Too many parking requests' } },
});

export const publicPickupLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { success: false, message: 'Too many pickup requests, please try again later', error: { code: 'RATE_LIMITED', message: 'Too many pickup requests' } },
});
