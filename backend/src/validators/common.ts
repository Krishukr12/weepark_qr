import { z } from 'zod';

/** Prisma `cuid()` values (cuid1 ≈ 25 chars). */
export const cuidId = z
  .string()
  .min(20, 'Invalid id')
  .max(32, 'Invalid id')
  .regex(/^c[a-z0-9]+$/i, 'Invalid id');

export const siteCodeSchema = z
  .string()
  .regex(/^WP-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/, 'Invalid site code');

export const vehicleNumberSchema = z
  .string()
  .min(4, 'Vehicle number is too short')
  .max(20)
  .transform((v) => v.toUpperCase().replace(/[\s-]/g, ''))
  .refine((v) => /^[A-Z0-9]+$/.test(v), 'Vehicle number contains invalid characters');

export const phoneSchema = z
  .string()
  .max(20)
  .transform((v) => v.replace(/[\s-()]/g, ''))
  .refine((v) => /^\+?[0-9]{10,15}$/.test(v), 'Enter a valid phone number');

export const optionalPhoneSchema = z
  .string()
  .max(20)
  .optional()
  .nullable()
  .or(z.literal(''))
  .transform((v) => {
    if (v === undefined || v === null || v === '') return null;
    return v.replace(/[\s-()]/g, '');
  })
  .refine((v) => v === null || /^\+?[0-9]{10,15}$/.test(v), 'Enter a valid phone number');

export const httpsOrHttpUrl = z
  .string()
  .url('Invalid URL')
  .refine((v) => v.startsWith('https://') || v.startsWith('http://'), 'URL must be http or https');

export const optionalUrl = httpsOrHttpUrl.optional().nullable().or(z.literal('')).transform((v) => {
  if (v === undefined || v === null || v === '') return null;
  return v;
});

/** JSON body integers — rejects string `"100"`. */
export const strictInt = (min: number, max: number) =>
  z
    .number({ error: 'Must be a number' })
    .int('Must be an integer')
    .finite()
    .min(min)
    .max(max);

/** Query-string integers (HTTP query values are always strings). */
export const queryInt = (min: number, max: number, fallback?: number) => {
  const inner = z.coerce.number().int().finite().min(min).max(max);
  return fallback === undefined ? inner : inner.optional().default(fallback);
};

export const searchQuery = z.string().max(100).optional();

export function dateRangeRefine<T extends { dateFrom?: Date; dateTo?: Date }>(data: T): boolean {
  if (data.dateFrom && data.dateTo && data.dateFrom > data.dateTo) return false;
  return true;
}
