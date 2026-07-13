/**
 * Seeds the initial Super Admin account only.
 * Idempotent — safe to run repeatedly.
 * Override via SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD if needed.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@weepark.in').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Krishukrishan1211@';

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: {
      name: 'Super Admin',
      passwordHash,
      role: 'SUPER_ADMIN',
      isActive: true,
      organizationId: null,
    },
    create: {
      name: 'Super Admin',
      email,
      passwordHash,
      role: 'SUPER_ADMIN',
    },
  });

  console.log('✅ Super admin ready');
  console.log(`   Email: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
