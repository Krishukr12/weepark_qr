import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { prisma } from '../../src/config/prisma';
import {
  ApiClient,
  cleanupTestData,
  createSuperAdmin,
  createTenant,
  dataOf,
  startTestServer,
  stopTestServer,
  unique,
  type TenantFixture,
} from '../helpers';

describe('organizations, sites, employees, vehicles', () => {
  let superAdmin: { email: string; password: string };
  let orgA: TenantFixture;
  let orgB: TenantFixture;
  let sa: ApiClient;

  beforeAll(async () => {
    await startTestServer();
    await cleanupTestData();
    superAdmin = await createSuperAdmin();
    orgA = await createTenant('orga');
    orgB = await createTenant('orgb');
    sa = new ApiClient();
    await sa.login(superAdmin.email, superAdmin.password);
  });

  afterAll(async () => {
    await cleanupTestData();
    await stopTestServer();
  });

  it('ORG_ADMIN cannot list all organizations', async () => {
    const admin = new ApiClient();
    await admin.login(orgA.admin.email, orgA.password);
    const res = await admin.request('/api/v1/organizations');
    expect(res.status).toBe(403);
  });

  it('ORG_ADMIN can read own org and not org B', async () => {
    const admin = new ApiClient();
    await admin.login(orgA.admin.email, orgA.password);
    const own = await admin.request(`/api/v1/organizations/${orgA.org.id}`);
    expect(own.status).toBe(200);
    const other = await admin.request(`/api/v1/organizations/${orgB.org.id}`);
    expect(other.status).toBe(403);
  });

  it('rejects invalid organization payloads', async () => {
    const res = await sa.request('/api/v1/organizations', {
      method: 'POST',
      body: JSON.stringify({
        name: 'X',
        companyName: 'Y',
        adminName: 'Z',
        adminEmail: 'not-email',
      }),
    });
    expect(res.status).toBe(400);
  });

  it('VALET cannot access site B', async () => {
    const valet = new ApiClient();
    await valet.login(orgA.valet.email, orgA.password);
    const allowed = await valet.request(`/api/v1/sites/${orgA.site.id}`);
    expect(allowed.status).toBe(200);
    expect(JSON.stringify(allowed.json)).not.toMatch(/@wptest\.local/);
    const denied = await valet.request(`/api/v1/sites/${orgB.site.id}`);
    expect([403, 404]).toContain(denied.status);
  });

  it('rejects invalid site capacity types', async () => {
    for (const totalCapacity of ['100', 'abc', -1, 0, 10.5, null]) {
      const res = await sa.request('/api/v1/sites', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Capacity probe',
          address: '12 Test Street, Bengaluru',
          totalCapacity,
        }),
      });
      expect(res.status).toBe(400);
    }
  });

  it('creates a site with a WP- site code', async () => {
    const res = await sa.request('/api/v1/sites', {
      method: 'POST',
      body: JSON.stringify({
        name: `API Site ${unique('s')}`,
        address: '12 Test Street, Bengaluru',
        totalCapacity: 25,
      }),
    });
    expect(res.status).toBe(201);
    const site = dataOf<{ siteCode: string; id: string }>(res.json);
    expect(site.siteCode).toMatch(/^WP-[A-HJ-NP-Z2-9]{6}$/);
    await prisma.site.delete({ where: { id: site.id } }).catch(() => undefined);
  });

  it('ORG_ADMIN cannot create employees in another org', async () => {
    const admin = new ApiClient();
    await admin.login(orgA.admin.email, orgA.password);
    const res = await admin.request('/api/v1/employees', {
      method: 'POST',
      body: JSON.stringify({
        employeeCode: 'X-1',
        name: 'Cross Org',
        email: `cross-${unique('e')}@wptest.local`,
        organizationId: orgB.org.id,
      }),
    });
    expect([201, 400]).toContain(res.status);
    if (res.status === 201) {
      const created = dataOf<{ id: string; organizationId: string }>(res.json);
      expect(created.organizationId).toBe(orgA.org.id);
    }
  });

  it('ORG_ADMIN cannot get another org employee', async () => {
    const admin = new ApiClient();
    await admin.login(orgA.admin.email, orgA.password);
    const res = await admin.request(`/api/v1/employees/${orgB.employee.id}`);
    expect(res.status).toBe(403);
  });

  it('VALET cannot manage employees or vehicles', async () => {
    const valet = new ApiClient();
    await valet.login(orgA.valet.email, orgA.password);
    expect((await valet.request('/api/v1/employees')).status).toBe(403);
    expect((await valet.request('/api/v1/vehicles')).status).toBe(403);
    expect((await valet.request('/api/v1/organizations')).status).toBe(403);
  });

  it('cannot attach a vehicle to another organization employee', async () => {
    const admin = new ApiClient();
    await admin.login(orgA.admin.email, orgA.password);
    const res = await admin.request('/api/v1/vehicles', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: orgB.employee.id,
        vehicleNumber: `WPTX${unique('v').replace(/[^A-Z0-9]/gi, '').slice(-6)}`.slice(0, 12),
        vehicleType: 'CAR',
      }),
    });
    expect([403, 404]).toContain(res.status);
  });

  it('normalizes vehicle numbers on create', async () => {
    const stamp = unique('veh').replace(/[^A-Z0-9]/gi, '').slice(-6);
    const admin = new ApiClient();
    await admin.login(orgA.admin.email, orgA.password);
    const res = await admin.request('/api/v1/vehicles', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: orgA.employee.id,
        vehicleNumber: `ka ${stamp}`,
        vehicleType: 'CAR',
      }),
    });
    expect(res.status).toBe(201);
    expect(dataOf<{ vehicleNumber: string }>(res.json).vehicleNumber).toBe(`KA${stamp}`.toUpperCase());
  });

  it('rejects duplicate vehicle numbers', async () => {
    const admin = new ApiClient();
    await admin.login(orgA.admin.email, orgA.password);
    const res = await admin.request('/api/v1/vehicles', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: orgA.employee.id,
        vehicleNumber: orgA.vehicle.vehicleNumber,
        vehicleType: 'CAR',
      }),
    });
    expect([400, 409]).toContain(res.status);
  });

  it('deactivating a valet revokes refresh', async () => {
    const valet = new ApiClient();
    await valet.login(orgA.valet.email, orgA.password);
    const deactivated = await sa.request(`/api/v1/valets/${orgA.valet.id}`, { method: 'DELETE' });
    expect(deactivated.status).toBe(200);
    const refresh = await valet.request('/api/v1/auth/refresh', { method: 'POST', body: '{}' });
    expect(refresh.status).toBe(401);
    await prisma.user.update({ where: { id: orgA.valet.id }, data: { isActive: true } });
  });
});
