/**
 * Seeds the initial Super Admin account. Idempotent — safe to run repeatedly.
 * Credentials can be overridden via SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@weepark.io';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@1234';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Super admin already exists: ${email}`);
    return;
  }

  await prisma.user.create({
    data: {
      name: 'Super Admin',
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: 'SUPER_ADMIN',
    },
  });

  console.log('✅ Super admin created');
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${password}`);
  console.log('   Change this password after first login.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
