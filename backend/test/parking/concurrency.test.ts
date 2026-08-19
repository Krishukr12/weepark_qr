import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { prisma } from '../../src/config/prisma';
import {
  ApiClient,
  cleanupTestData,
  createTenant,
  startTestServer,
  stopTestServer,
  unique,
  type TenantFixture,
} from '../helpers';

describe('parking concurrency against PostgreSQL', () => {
  let tenant: TenantFixture;
  const client = new ApiClient();

  beforeAll(async () => {
    await startTestServer();
    await cleanupTestData();
    tenant = await createTenant('race');
  });

  afterAll(async () => {
    await cleanupTestData();
    await stopTestServer();
  });

  it('50 simultaneous park requests create exactly one active session', async () => {
    const stamp = `WPT50${unique('c').replace(/[^A-Z0-9]/gi, '').slice(-5)}`.slice(0, 12).toUpperCase();
    const employee = await prisma.employee.create({
      data: {
        employeeCode: `EMP-${stamp}`,
        name: 'Race Emp',
        email: `race-${stamp}@wptest.local`,
        organizationId: tenant.org.id,
      },
    });
    const vehicle = await prisma.vehicle.create({
      data: { vehicleNumber: stamp, vehicleType: 'CAR', employeeId: employee.id },
    });
    const lookup = await client.request(`/api/v1/public/parking/sites/${tenant.site.siteCode}/lookup`, {
      method: 'POST',
      body: JSON.stringify({ vehicleNumber: stamp }),
    });
    const parkToken = (lookup.json?.data as { parkToken?: string }).parkToken;
    expect(parkToken).toBeTruthy();

    const results = await Promise.all(
      Array.from({ length: 50 }, () =>
        client.request(`/api/v1/public/parking/sites/${tenant.site.siteCode}/park`, {
          method: 'POST',
          body: JSON.stringify({ parkToken }),
        }),
      ),
    );
    const created = results.filter((r) => r.status === 201);
    const rejected = results.filter((r) => r.status === 409 || r.status === 400);
    expect(created).toHaveLength(1);
    expect(rejected.length).toBe(49);

    const active = await prisma.parkingEntry.count({
      where: { vehicleId: vehicle.id, status: { in: ['PARKED', 'PICKUP_REQUESTED', 'PICKUP_IN_PROGRESS'] } },
    });
    expect(active).toBe(1);
  }, 60_000);

  it('capacity cannot be exceeded by concurrent parks', async () => {
    await prisma.site.update({ where: { id: tenant.site.id }, data: { totalCapacity: 1 } });
    const stamp = `WPTCAP${unique('c').replace(/[^A-Z0-9]/gi, '').slice(-4)}`.slice(0, 12).toUpperCase();
    const employee = await prisma.employee.create({
      data: {
        employeeCode: `EMP-${stamp}`,
        name: 'Cap Emp',
        email: `cap-${stamp}@wptest.local`,
        organizationId: tenant.org.id,
      },
    });
    await prisma.vehicle.create({
      data: { vehicleNumber: stamp, vehicleType: 'CAR', employeeId: employee.id },
    });
    const lookup = await client.request(`/api/v1/public/parking/sites/${tenant.site.siteCode}/lookup`, {
      method: 'POST',
      body: JSON.stringify({ vehicleNumber: stamp }),
    });
    const parkToken = (lookup.json?.data as { parkToken?: string }).parkToken;
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        client.request(`/api/v1/public/parking/sites/${tenant.site.siteCode}/park`, {
          method: 'POST',
          body: JSON.stringify({ parkToken }),
        }),
      ),
    );
    const occupied = await prisma.parkingEntry.count({
      where: { siteId: tenant.site.id, status: { in: ['PARKED', 'PICKUP_REQUESTED', 'PICKUP_IN_PROGRESS'] } },
    });
    expect(occupied).toBeLessThanOrEqual(1);
    expect(results.filter((r) => r.status === 201).length + results.filter((r) => r.status === 409).length).toBe(10);
    await prisma.site.update({ where: { id: tenant.site.id }, data: { totalCapacity: 20 } });
  }, 60_000);
});
