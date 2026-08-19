import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import {
  ApiClient,
  cleanupTestData,
  createSuperAdmin,
  createTenant,
  lookupAndPark,
  requestPickup,
  startTestServer,
  stopTestServer,
} from '../helpers';

describe('critical-path smoke', () => {
  beforeAll(async () => {
    await startTestServer();
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await stopTestServer();
  });

  it('health, login, QR park, pickup, dashboard', async () => {
    const health = await new ApiClient().request('/health');
    expect(health.status).toBe(200);
    expect((health.json as { db?: string }).db).toBe('up');

    const superAdmin = await createSuperAdmin();
    const tenant = await createTenant('smoke');
    const admin = new ApiClient();
    expect((await admin.login(superAdmin.email, superAdmin.password)).status).toBe(200);

    const publicClient = new ApiClient();
    const parked = await lookupAndPark(publicClient, tenant.site.siteCode, tenant.vehicle.vehicleNumber);
    expect(parked.parking.status).toBe('PARKED');

    const pickup = await requestPickup(
      publicClient,
      parked.sessionToken,
      parked.parking.vehicleNumber,
      parked.parking.ticketCode,
    );
    expect(pickup.status).toBe(201);

    const valet = new ApiClient();
    await valet.login(tenant.valet.email, tenant.password);
    const list = await valet.request('/api/v1/pickups');
    expect(list.status).toBe(200);

    const stats = await admin.request('/api/v1/dashboard/stats');
    expect(stats.status).toBe(200);
  });
});
