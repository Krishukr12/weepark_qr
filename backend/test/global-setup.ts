import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const backendRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(backendRoot, '.env') });

function testDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL?.trim()) return process.env.TEST_DATABASE_URL.trim();
  const source = process.env.DATABASE_URL;
  if (!source) throw new Error('DATABASE_URL is required');
  const parsed = new URL(source);
  if (!parsed.pathname.endsWith('_test')) {
    parsed.pathname = `${parsed.pathname.replace(/\/$/, '')}_test`;
  }
  return parsed.toString();
}

export default async function globalSetup(): Promise<void> {
  const url = testDatabaseUrl();
  if (!/localhost|127\.0\.0\.1/.test(url)) {
    throw new Error('Refusing to run automated tests against a non-local database');
  }

  process.env.DATABASE_URL = url;
  process.env.NODE_ENV = 'test';

  const dbName = new URL(url).pathname.replace(/^\//, '');
  try {
    execFileSync(
      'docker',
      ['exec', 'weepark-postgres', 'psql', '-U', 'weepark', '-d', 'postgres', '-c', `CREATE DATABASE "${dbName}"`],
      { stdio: 'pipe' },
    );
  } catch {
    // Database already exists.
  }

  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: backendRoot,
    env: { ...process.env, DATABASE_URL: url, NODE_ENV: 'test' },
    stdio: 'inherit',
  });
}
