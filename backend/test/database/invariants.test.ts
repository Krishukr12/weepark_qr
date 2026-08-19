import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { prisma } from '../../src/config/prisma';
import {
  ApiClient,
  cleanupTestData,
  createTenant,
  lookupAndPark,
  startTestServer,
  stopTestServer,
  type TenantFixture,
} from '../helpers';

describe('database business invariants', () => {
  let tenant: TenantFixture;
  let other: TenantFixture;

  beforeAll(async () => {
    await startTestServer();
    await cleanupTestData();
    tenant = await createTenant('inv');
    other = await createTenant('invb');
  });

  afterAll(async () => {
    await cleanupTestData();
    await stopTestServer();
  });

  it('a vehicle cannot have two active parking sessions', async () => {
    const client = new ApiClient();
    await lookupAndPark(client, tenant.site.siteCode, tenant.vehicle.vehicleNumber);
    await expect(
      prisma.parkingEntry.create({
        data: {
          ticketCode: `TKT-DUP-${Date.now()}`,
          status: 'PARKED',
          vehicleId: tenant.vehicle.id,
          employeeId: tenant.employee.id,
          organizationId: tenant.org.id,
          siteId: tenant.site.id,
        },
      }),
    ).rejects.toThrow();
  });

  it('vehicle belongs to the intended employee and organization', async () => {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: tenant.vehicle.id },
      include: { employee: true },
    });
    expect(vehicle?.employeeId).toBe(tenant.employee.id);
    expect(vehicle?.employee.organizationId).toBe(tenant.org.id);
  });

  it('pickup belongs to one parking entry', async () => {
    const client = new ApiClient();
    const parked = await lookupAndPark(client, other.site.siteCode, other.vehicle.vehicleNumber);
    await client.request('/api/v1/public/pickups/request', {
      method: 'POST',
      body: JSON.stringify({
        sessionToken: parked.sessionToken,
        vehicleNumber: parked.parking.vehicleNumber,
        ticketCode: parked.parking.ticketCode,
      }),
    });
    const pickups = await prisma.pickupRequest.findMany({
      where: { parkingEntry: { vehicleId: other.vehicle.id } },
    });
    expect(pickups).toHaveLength(1);
  });

  it('ORG_ADMIN cannot read another organization parking row', async () => {
    const entry = await prisma.parkingEntry.findFirst({
      where: { vehicleId: other.vehicle.id },
    });
    expect(entry).toBeTruthy();
    const admin = new ApiClient();
    await admin.login(tenant.admin.email, tenant.password);
    const res = await admin.request(`/api/v1/parking/${entry!.id}`);
    expect([403, 404]).toContain(res.status);
  });
});
