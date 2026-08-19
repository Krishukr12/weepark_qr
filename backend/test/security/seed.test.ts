import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { prisma } from '../../src/config/prisma';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function runSeed(env: NodeJS.ProcessEnv) {
  return spawnSync('pnpm', ['exec', 'tsx', 'prisma/seed.ts'], {
    cwd: backendRoot,
    env,
    encoding: 'utf8',
  });
}

describe('seed does not reset an existing administrator password', () => {
  it('leaves passwordHash unchanged when the user already exists', async () => {
    const email = `seed-admin-${Date.now()}@wptest.local`;
    const firstPassword = 'SeedPassword1234';
    const secondPassword = 'DifferentPass1234';

    const first = runSeed({
      ...process.env,
      SEED_ADMIN_EMAIL: email,
      SEED_ADMIN_PASSWORD: firstPassword,
    });
    assert.equal(first.status, 0, first.stderr || first.stdout);

    const created = await prisma.user.findUnique({ where: { email } });
    assert.ok(created);
    const originalHash = created!.passwordHash;
    assert.equal(await bcrypt.compare(firstPassword, originalHash), true);

    const second = runSeed({
      ...process.env,
      SEED_ADMIN_EMAIL: email,
      SEED_ADMIN_PASSWORD: secondPassword,
    });
    assert.equal(second.status, 0, second.stderr || second.stdout);
    assert.match(second.stdout, /password was not changed/);

    const after = await prisma.user.findUnique({ where: { email } });
    assert.equal(after?.passwordHash, originalHash);
    assert.equal(await bcrypt.compare(secondPassword, after!.passwordHash), false);

    await prisma.user.delete({ where: { email } });
  });

  it('fails when SEED_ADMIN_PASSWORD is missing', () => {
    const result = runSeed({
      ...process.env,
      SEED_ADMIN_EMAIL: 'missing-pass@wptest.local',
      SEED_ADMIN_PASSWORD: '',
    });
    assert.notEqual(result.status, 0);
  });
});
