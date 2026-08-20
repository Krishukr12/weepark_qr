import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { prisma } from '../../src/config/prisma';
import {
  ApiClient,
  cleanupTestData,
  createB2cTenant,
  createTenant,
  dataOf,
  hash,
  lookupAndPark,
  requestPickup,
  startTestServer,
  stopTestServer,
  unique,
} from '../helpers';

function recipientsFor(type: 'VEHICLE_PARKED' | 'PICKUP_REQUESTED' | 'PICKUP_ACCEPTED', pickupOrEntryId: string) {
  return prisma.notification.findMany({ where: { type } }).then((notes) =>
    notes
      .filter((note) => {
        const data = note.data as { pickupRequestId?: string; parkingEntryId?: string } | null;
        return data?.pickupRequestId === pickupOrEntryId || data?.parkingEntryId === pickupOrEntryId;
      })
      .map((note) => note.userId),
  );
}

async function guestPark(
  client: ApiClient,
  siteCode: string,
  vehicleNumber: string,
  phone: string,
): Promise<{ sessionToken: string; parking: { ticketCode: string; vehicleNumber: string; status: string } }> {
  const checkIn = await client.request(`/api/v1/public/parking/sites/${siteCode}/guest`, {
    method: 'POST',
    body: JSON.stringify({ vehicleNumber, phone }),
  });
  const looked = dataOf<{ parkToken?: string }>(checkIn.json);
  if (!looked.parkToken) {
    throw new Error(`No parkToken for guest ${vehicleNumber}: ${JSON.stringify(checkIn.json)}`);
  }
  const parked = await client.request(`/api/v1/public/parking/sites/${siteCode}/park`, {
    method: 'POST',
    body: JSON.stringify({ parkToken: looked.parkToken }),
  });
  if (parked.status !== 201) {
    throw new Error(`Guest park failed (${parked.status}): ${JSON.stringify(parked.json)}`);
  }
  return dataOf(parked.json);
}

describe('site valet park and pickup notifications', () => {
  beforeAll(async () => {
    await startTestServer();
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await stopTestServer();
  });

  it('B2B park and unaccepted pickup notify every valet on the site, then accept notifies them all', async () => {
    const tenant = await createTenant('nfb2b');
    const extra = await prisma.user.create({
      data: {
        name: 'Site Valet Two',
        email: `valet-two-${unique('n2')}@wptest.local`,
        passwordHash: await hash('TestPass1234'),
        role: 'VALET',
      },
    });
    await prisma.valetSiteAssignment.create({ data: { valetId: extra.id, siteId: tenant.site.id } });

    const publicClient = new ApiClient();
    const parked = await lookupAndPark(publicClient, tenant.site.siteCode, tenant.vehicle.vehicleNumber);
    const entry = await prisma.parkingEntry.findFirst({
      where: { vehicleId: tenant.vehicle.id, status: 'PARKED' },
      select: { id: true },
    });
    expect(entry).toBeTruthy();
    const parkedRecipients = await recipientsFor('VEHICLE_PARKED', entry!.id);
    expect(parkedRecipients.sort()).toEqual([tenant.valet.id, extra.id].sort());
    expect(parkedRecipients).not.toContain(tenant.otherValet.id);

    const requested = await requestPickup(
      publicClient,
      parked.sessionToken,
      parked.parking.vehicleNumber,
      parked.parking.ticketCode,
    );
    expect(requested.status).toBe(201);
    const pickupId = dataOf<{ id: string }>(requested.json).id;
    const requestRecipients = await recipientsFor('PICKUP_REQUESTED', pickupId);
    expect(requestRecipients.sort()).toEqual([tenant.valet.id, extra.id].sort());
    expect(requestRecipients).not.toContain(tenant.otherValet.id);
    expect(requestRecipients).not.toContain(tenant.admin.id);

    const valet = new ApiClient();
    await valet.login(tenant.valet.email, tenant.password);
    expect((await valet.request(`/api/v1/pickups/${pickupId}/accept`, { method: 'POST', body: '{}' })).status).toBe(200);

    const acceptRecipients = await recipientsFor('PICKUP_ACCEPTED', pickupId);
    expect(acceptRecipients.sort()).toEqual([tenant.valet.id, extra.id].sort());
    expect(acceptRecipients).not.toContain(tenant.otherValet.id);
  });

  it('B2C guest park and GET MY CAR notify every valet assigned to that walk-in site', async () => {
    const b2c = await createB2cTenant('nfb2c');
    const extra = await prisma.user.create({
      data: {
        name: 'B2C Valet Two',
        email: `b2c-valet-two-${unique('c2')}@wptest.local`,
        passwordHash: await hash('TestPass1234'),
        role: 'VALET',
      },
    });
    await prisma.valetSiteAssignment.create({ data: { valetId: extra.id, siteId: b2c.site.id } });
    const outsider = await createTenant('nfout');

    const publicClient = new ApiClient();
    const plate = `WPTN${unique('gp').replace(/[^A-Z0-9]/gi, '').slice(-6)}`.slice(0, 12).toUpperCase();
    const parked = await guestPark(publicClient, b2c.site.siteCode, plate, '9000000070');
    const entry = await prisma.parkingEntry.findFirst({
      where: { vehicle: { vehicleNumber: plate } },
      select: { id: true },
    });
    expect(entry).toBeTruthy();
    const parkedRecipients = await recipientsFor('VEHICLE_PARKED', entry!.id);
    expect(parkedRecipients.sort()).toEqual([b2c.valet.id, extra.id].sort());
    expect(parkedRecipients).not.toContain(outsider.valet.id);

    const requested = await requestPickup(
      publicClient,
      parked.sessionToken,
      parked.parking.vehicleNumber,
      parked.parking.ticketCode,
    );
    expect(requested.status).toBe(201);
    const pickupId = dataOf<{ id: string }>(requested.json).id;
    const requestRecipients = await recipientsFor('PICKUP_REQUESTED', pickupId);
    expect(requestRecipients.sort()).toEqual([b2c.valet.id, extra.id].sort());
    expect(requestRecipients).not.toContain(outsider.valet.id);
    expect(requestRecipients).not.toContain(b2c.admin.id);
  });
});
