import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const WEAK_SECRET = /change-me|secret-32chars|replace_this_with/i;

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  API_URL: z.string().default('http://localhost:4000'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .refine(
      (url) => process.env.NODE_ENV !== 'production' || !/\/\/weepark:weepark@/i.test(url),
      'Default database credentials are not allowed in production',
    ),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters')
    .refine((v) => !WEAK_SECRET.test(v), 'JWT_ACCESS_SECRET is a placeholder — generate a random secret'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters')
    .refine((v) => !WEAK_SECRET.test(v), 'JWT_REFRESH_SECRET is a placeholder — generate a random secret')
    .refine((v) => v !== process.env.JWT_ACCESS_SECRET, 'JWT_REFRESH_SECRET must differ from JWT_ACCESS_SECRET'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  EMAIL_FROM: z.string().default('weepark <no-reply@weepark.in>'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().default(300),
  ENFORCE_HTTPS: z
    .string()
    .optional()
    .default('false')
    .transform((v) => v === 'true'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
