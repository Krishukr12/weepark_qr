import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { prisma } from '../../src/config/prisma';
import {
  ApiClient,
  cleanupTestData,
  createTenant,
  lookupAndPark,
  requestPickup,
  startTestServer,
  stopTestServer,
  type TenantFixture,
} from '../helpers';

describe('pickup concurrency', () => {
  let tenant: TenantFixture;

  beforeAll(async () => {
    await startTestServer();
    await cleanupTestData();
    tenant = await createTenant('pkup');
  });

  afterAll(async () => {
    await cleanupTestData();
    await stopTestServer();
  });

  it('two simultaneous GET MY CAR requests create one pickup', async () => {
    const publicClient = new ApiClient();
    const parked = await lookupAndPark(publicClient, tenant.site.siteCode, tenant.vehicle.vehicleNumber);
    const results = await Promise.all(
      Array.from({ length: 2 }, () =>
        requestPickup(
          publicClient,
          parked.sessionToken,
          parked.parking.vehicleNumber,
          parked.parking.ticketCode,
        ),
      ),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(1);
    const count = await prisma.pickupRequest.count({
      where: { parkingEntry: { vehicleId: tenant.vehicle.id } },
    });
    expect(count).toBe(1);
  });

  it('two valets cannot both accept the same pickup', async () => {
    const extra = await createTenant('pkup2');
    const publicClient = new ApiClient();
    const parked = await lookupAndPark(publicClient, extra.site.siteCode, extra.vehicle.vehicleNumber);
    const requested = await requestPickup(
      publicClient,
      parked.sessionToken,
      parked.parking.vehicleNumber,
      parked.parking.ticketCode,
    );
    expect(requested.status).toBe(201);
    const pickupId = (requested.json?.data as { id: string }).id;

    const second = await prisma.user.create({
      data: {
        name: 'Second Valet',
        email: extra.valet.email.replace('@', '+2@'),
        passwordHash: (await prisma.user.findUnique({ where: { id: extra.valet.id } }))!.passwordHash,
        role: 'VALET',
      },
    });
    await prisma.valetSiteAssignment.create({ data: { valetId: second.id, siteId: extra.site.id } });

    const v1 = new ApiClient();
    const v2 = new ApiClient();
    await v1.login(extra.valet.email, extra.password);
    const login2 = await v2.login(extra.valet.email.replace('@', '+2@'), extra.password);
    expect(login2.status).toBe(200);

    const [a, b] = await Promise.all([
      v1.request(`/api/v1/pickups/${pickupId}/accept`, { method: 'POST', body: '{}' }),
      v2.request(`/api/v1/pickups/${pickupId}/accept`, { method: 'POST', body: '{}' }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);
    const pickup = await prisma.pickupRequest.findUnique({ where: { id: pickupId } });
    expect(pickup?.status).toBe('ACCEPTED');
    expect(pickup?.acceptedById).toBeTruthy();
  });

  it('a foreign valet cannot accept a pickup at another site', async () => {
    const extra = await createTenant('pkup3');
    const publicClient = new ApiClient();
    const parked = await lookupAndPark(publicClient, extra.site.siteCode, extra.vehicle.vehicleNumber);
    const requested = await requestPickup(
      publicClient,
      parked.sessionToken,
      parked.parking.vehicleNumber,
      parked.parking.ticketCode,
    );
    const pickupId = (requested.json?.data as { id: string }).id;
    const foreign = new ApiClient();
    await foreign.login(tenant.valet.email, tenant.password);
    const res = await foreign.request(`/api/v1/pickups/${pickupId}/accept`, { method: 'POST', body: '{}' });
    expect(res.status).toBe(403);
  });
});
