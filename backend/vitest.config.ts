import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';

const root = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(root, '.env') });

function localTestDatabaseUrl(): string {
  const fromEnv = process.env.TEST_DATABASE_URL?.trim();
  const source = fromEnv || process.env.DATABASE_URL || '';
  if (!source) {
    throw new Error('DATABASE_URL or TEST_DATABASE_URL is required for tests');
  }
  if (!/localhost|127\.0\.0\.1/.test(source)) {
    throw new Error('Refusing to run automated tests against a non-local database');
  }
  if (fromEnv) return fromEnv;
  const parsed = new URL(source);
  if (!parsed.pathname.endsWith('_test')) {
    parsed.pathname = `${parsed.pathname.replace(/\/$/, '')}_test`;
  }
  return parsed.toString();
}

const testDatabaseUrl = localTestDatabaseUrl();

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    setupFiles: ['./test/setup.ts'],
    globalSetup: ['./test/global-setup.ts'],
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/config/swagger.ts'],
    },
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDatabaseUrl,
    },
  },
});
