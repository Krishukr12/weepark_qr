/**
 * Seeds the initial Super Admin account only.
 * Idempotent — safe to run repeatedly.
 * Requires SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD.
 * Never overwrites an existing user's password.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required. Refusing to seed a default password.');
    process.exit(1);
  }

  if (password.length < 12) {
    console.error('SEED_ADMIN_PASSWORD must be at least 12 characters.');
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { email },
      data: {
        name: existing.name || 'Super Admin',
        role: 'SUPER_ADMIN',
        isActive: true,
        organizationId: null,
      },
    });
    console.log('Super admin already exists — password was not changed');
    console.log(`   Email: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      name: 'Super Admin',
      email,
      passwordHash,
      role: 'SUPER_ADMIN',
    },
  });

  console.log('Super admin created');
  console.log(`   Email: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
