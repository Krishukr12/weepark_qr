import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { prisma } from '../../src/config/prisma';
import { signParkAuth } from '../../src/utils/parkingToken';
import {
  ApiClient,
  cleanupTestData,
  createTenant,
  dataOf,
  lookupAndPark,
  requestPickup,
  startTestServer,
  stopTestServer,
  type TenantFixture,
} from '../helpers';

describe('public QR, parking, and pickup', () => {
  let tenant: TenantFixture;
  let other: TenantFixture;

  beforeAll(async () => {
    await startTestServer();
    await cleanupTestData();
    tenant = await createTenant('qr');
    other = await createTenant('qrb');
  });

  afterAll(async () => {
    await cleanupTestData();
    await stopTestServer();
  });

  it('unknown site codes 404, malformed codes 400', async () => {
    const client = new ApiClient();
    expect((await client.request('/api/v1/public/parking/sites/WP-ABCDEF')).status).toBe(404);
    expect((await client.request('/api/v1/public/parking/sites/not-a-code')).status).toBe(400);
  });

  it('inactive site is not publicly visible', async () => {
    await prisma.site.update({ where: { id: tenant.site.id }, data: { isActive: false } });
    const client = new ApiClient();
    const res = await client.request(`/api/v1/public/parking/sites/${tenant.site.siteCode}`);
    expect(res.status).toBe(404);
    await prisma.site.update({ where: { id: tenant.site.id }, data: { isActive: true } });
  });

  it('lookup of an unknown vehicle does not leak PII and has no parkToken', async () => {
    const client = new ApiClient();
    const res = await client.request(`/api/v1/public/parking/sites/${tenant.site.siteCode}/lookup`, {
      method: 'POST',
      body: JSON.stringify({ vehicleNumber: 'ZZ99UNKNOWN' }),
    });
    expect(res.status).toBe(200);
    const data = dataOf<{ found: boolean; parkToken?: string }>(res.json);
    expect(data.found).toBe(false);
    expect(data.parkToken).toBeUndefined();
    expect(JSON.stringify(res.json)).not.toMatch(/@wptest\.local|9876543210/);
  });

  it('parks, returns a session, and rejects a second park', async () => {
    const client = new ApiClient();
    const parked = await lookupAndPark(client, tenant.site.siteCode, tenant.vehicle.vehicleNumber);
    expect(parked.parking.status).toBe('PARKED');
    expect(parked.sessionToken.length).toBeGreaterThan(20);

    const lookup = await client.request(`/api/v1/public/parking/sites/${tenant.site.siteCode}/lookup`, {
      method: 'POST',
      body: JSON.stringify({ vehicleNumber: tenant.vehicle.vehicleNumber }),
    });
    const again = dataOf<{ alreadyParked: boolean; parkToken?: string }>(lookup.json);
    expect(again.alreadyParked).toBe(true);
    expect(again.parkToken).toBeUndefined();
  });

  it('rejects a tampered or foreign-site park token', async () => {
    const client = new ApiClient();
    const forged = signParkAuth({
      vehicleId: tenant.vehicle.id,
      siteId: tenant.site.id,
      siteCode: other.site.siteCode,
    });
    const res = await client.request(`/api/v1/public/parking/sites/${other.site.siteCode}/park`, {
      method: 'POST',
      body: JSON.stringify({ parkToken: forged }),
    });
    expect([403, 400]).toContain(res.status);

    const bad = await client.request(`/api/v1/public/parking/sites/${tenant.site.siteCode}/park`, {
      method: 'POST',
      body: JSON.stringify({ parkToken: 'aaaa.bbbb.cccc.dddd.eeee' }),
    });
    expect(bad.status).toBe(401);
  });

  it('inactive employee cannot receive a park token', async () => {
    await prisma.employee.update({ where: { id: other.employee.id }, data: { isActive: false } });
    const client = new ApiClient();
    const res = await client.request(`/api/v1/public/parking/sites/${other.site.siteCode}/lookup`, {
      method: 'POST',
      body: JSON.stringify({ vehicleNumber: other.vehicle.vehicleNumber }),
    });
    const data = dataOf<{ canParkAtSite: boolean; parkToken?: string }>(res.json);
    expect(data.canParkAtSite).toBe(false);
    expect(data.parkToken).toBeUndefined();
    await prisma.employee.update({ where: { id: other.employee.id }, data: { isActive: true } });
  });

  it('requests pickup then rejects a duplicate', async () => {
    const client = new ApiClient();
    const parked = await lookupAndPark(client, other.site.siteCode, other.vehicle.vehicleNumber);
    const first = await requestPickup(
      client,
      parked.sessionToken,
      parked.parking.vehicleNumber,
      parked.parking.ticketCode,
    );
    expect(first.status).toBe(201);
    const second = await requestPickup(
      client,
      parked.sessionToken,
      parked.parking.vehicleNumber,
      parked.parking.ticketCode,
    );
    expect(second.status).toBe(409);
  });

  it('does not allow COMPLETED → pickup', async () => {
    const entry = await prisma.parkingEntry.findFirst({
      where: { vehicleId: other.vehicle.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(entry).toBeTruthy();
    await prisma.parkingEntry.update({
      where: { id: entry!.id },
      data: { status: 'COMPLETED', pickedUpAt: new Date() },
    });
    await prisma.pickupRequest.updateMany({
      where: { parkingEntryId: entry!.id },
      data: { status: 'COMPLETED' },
    });
    const client = new ApiClient();
    const lookup = await client.request(`/api/v1/public/parking/sites/${other.site.siteCode}/lookup`, {
      method: 'POST',
      body: JSON.stringify({ vehicleNumber: other.vehicle.vehicleNumber }),
    });
    const session = dataOf<{ sessionToken?: string; parking?: { ticketCode: string } }>(lookup.json);
    if (session.sessionToken && session.parking) {
      const pickup = await requestPickup(
        client,
        session.sessionToken,
        other.vehicle.vehicleNumber,
        session.parking.ticketCode,
      );
      expect([403, 409, 400]).toContain(pickup.status);
    }
  });
});
