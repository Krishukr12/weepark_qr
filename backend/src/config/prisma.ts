import { PrismaClient } from '@prisma/client';
import { env, isProduction } from './env';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function databaseUrl(): string {
  const url = env.DATABASE_URL;
  if (/connect_timeout=|connection_limit=/.test(url)) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}connect_timeout=10&pool_timeout=10&connection_limit=10`;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction ? ['error'] : ['warn', 'error'],
    datasources: { db: { url: databaseUrl() } },
  });

if (!isProduction) globalForPrisma.prisma = prisma;
