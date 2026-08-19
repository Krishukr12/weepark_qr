import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import {
  ApiClient,
  api,
  cleanupTestData,
  createSuperAdmin,
  createTenant,
  dataOf,
  errorEnvelope,
  startTestServer,
  stopTestServer,
  type TenantFixture,
} from '../helpers';

describe('auth HTTP', () => {
  let tenant: TenantFixture;
  let superAdmin: { email: string; password: string };

  beforeAll(async () => {
    await startTestServer();
    await cleanupTestData();
    superAdmin = await createSuperAdmin();
    tenant = await createTenant('auth');
  });

  afterAll(async () => {
    await cleanupTestData();
    await stopTestServer();
  });

  it('logs in via supertest and sets an HttpOnly refresh cookie', async () => {
    const res = await api().post('/api/v1/auth/login').send({
      email: tenant.admin.email,
      password: tenant.password,
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.refreshToken).toBeUndefined();
    expect(res.body.data.user.email).toBe(tenant.admin.email);
    const setCookie = String(res.headers['set-cookie'] ?? '');
    expect(setCookie).toMatch(/weepark_refresh=/);
    expect(setCookie.toLowerCase()).toMatch(/httponly/);
  });

  it('rejects missing, empty, malformed, and oversized login bodies', async () => {
    const cases = [
      {},
      { email: tenant.admin.email },
      { password: tenant.password },
      { email: '', password: tenant.password },
      { email: tenant.admin.email, password: '' },
      { email: 'not-an-email', password: tenant.password },
      { email: `${'a'.repeat(300)}@wptest.local`, password: tenant.password },
    ];
    for (const body of cases) {
      const res = await api().post('/api/v1/auth/login').send(body);
      expect([400, 401]).toContain(res.status);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.code).toEqual(expect.any(String));
    }
  });

  it('rejects unknown email the same way as a wrong password', async () => {
    const unknown = await api().post('/api/v1/auth/login').send({
      email: 'nobody@wptest.local',
      password: 'TestPass1234',
    });
    const wrong = await api().post('/api/v1/auth/login').send({
      email: tenant.admin.email,
      password: 'WrongPass1234',
    });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.message).toBe(wrong.body.message);
  });

  it('rejects refresh without a cookie', async () => {
    const res = await api().post('/api/v1/auth/refresh').send({});
    expect(res.status).toBe(401);
  });

  it('rejects a malformed refresh cookie', async () => {
    const res = await api().post('/api/v1/auth/refresh').set('Cookie', 'weepark_refresh=not-a-jwt');
    expect(res.status).toBe(401);
  });

  it('logs out and then rejects refresh', async () => {
    const client = new ApiClient();
    await client.login(tenant.admin.email, tenant.password);
    const loggedOut = await client.request('/api/v1/auth/logout', { method: 'POST', body: '{}' });
    expect(loggedOut.status).toBe(200);
    const refresh = await client.request('/api/v1/auth/refresh', { method: 'POST', body: '{}' });
    expect(refresh.status).toBe(401);
  });

  it('rejects password change with the wrong current password', async () => {
    const client = new ApiClient();
    await client.login(tenant.admin.email, tenant.password);
    const res = await client.request('/api/v1/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: 'Nope1234', newPassword: 'NewPass1234' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects a weak new password', async () => {
    const client = new ApiClient();
    await client.login(tenant.admin.email, tenant.password);
    const res = await client.request('/api/v1/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: tenant.password, newPassword: 'short' }),
    });
    expect(res.status).toBe(400);
  });

  it('forgot-password does not reveal whether the email exists', async () => {
    const known = await api().post('/api/v1/auth/forgot-password').send({ email: tenant.admin.email });
    const unknown = await api().post('/api/v1/auth/forgot-password').send({ email: 'missing@wptest.local' });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body.message).toBe(unknown.body.message);
  });

  it('rejects an invalid reset token', async () => {
    const res = await api().post('/api/v1/auth/reset-password').send({
      token: 'deadbeef',
      password: 'NewPass1234',
    });
    expect(res.status).toBe(400);
  });

  it('returns a consistent error envelope', async () => {
    const res = await api().post('/api/v1/auth/login').send({ email: 'x', password: 'y' });
    expect(res.body.success).toBe(false);
    expect(errorEnvelope(res.body).code).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|JWT_|stack/i);
  });

  it('super admin can call /auth/me', async () => {
    const client = new ApiClient();
    const login = await client.login(superAdmin.email, superAdmin.password);
    expect(login.status).toBe(200);
    const me = await client.request('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(dataOf<{ role: string }>(me.json).role).toBe('SUPER_ADMIN');
  });
});
