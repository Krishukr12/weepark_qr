import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import {
  ApiClient,
  cleanupTestData,
  createTenant,
  lookupAndPark,
  startTestServer,
  stopTestServer,
  type TenantFixture,
} from '../helpers';

describe('RBAC and tenant isolation', () => {
  let orgA: TenantFixture;
  let orgB: TenantFixture;

  beforeAll(async () => {
    await startTestServer();
    await cleanupTestData();
    orgA = await createTenant('rbaca');
    orgB = await createTenant('rbacb');
  });

  afterAll(async () => {
    await cleanupTestData();
    await stopTestServer();
  });

  it('ORG_ADMIN cannot list another organization employees', async () => {
    const admin = new ApiClient();
    await admin.login(orgA.admin.email, orgA.password);
    const res = await admin.request(`/api/v1/employees?organizationId=${orgB.org.id}`);
    expect(res.status).toBe(200);
    const items = (res.json?.data as { email?: string }[]) ?? [];
    expect(items.some((e) => e.email === orgB.employee.email)).toBe(false);
  });

  it('ORG_ADMIN cannot read another organization vehicle', async () => {
    const admin = new ApiClient();
    await admin.login(orgA.admin.email, orgA.password);
    const res = await admin.request(`/api/v1/vehicles/${orgB.vehicle.id}`);
    expect([403, 404]).toContain(res.status);
  });

  it('CSV export for org A does not include org B vehicle numbers', async () => {
    const publicClient = new ApiClient();
    await lookupAndPark(publicClient, orgB.site.siteCode, orgB.vehicle.vehicleNumber);
    const admin = new ApiClient();
    await admin.login(orgA.admin.email, orgA.password);
    const res = await fetch(`${(await import('../helpers')).baseUrl}/api/v1/parking/export/csv`, {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
    });
    expect(res.status).toBe(200);
    const csv = await res.text();
    expect(csv).not.toContain(orgB.vehicle.vehicleNumber);
  });

  it('valet cannot create an organization', async () => {
    const valet = new ApiClient();
    await valet.login(orgA.valet.email, orgA.password);
    const res = await valet.request('/api/v1/organizations', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Nope',
        companyName: 'Nope Ltd',
        adminName: 'X',
        adminEmail: 'x@wptest.local',
        parkingAllocation: 1,
      }),
    });
    expect(res.status).toBe(403);
  });
});
