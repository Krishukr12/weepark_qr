import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { prisma } from '../../src/config/prisma';
import {
  ApiClient,
  cleanupTestData,
  createB2cTenant,
  createSuperAdmin,
  createTenant,
  dataOf,
  hash,
  requestPickup,
  startTestServer,
  stopTestServer,
  unique,
  type B2cTenantFixture,
  type TenantFixture,
} from '../helpers';

async function guestCheckIn(
  client: ApiClient,
  siteCode: string,
  vehicleNumber: string,
  phone: string,
) {
  return client.request(`/api/v1/public/parking/sites/${siteCode}/guest`, {
    method: 'POST',
    body: JSON.stringify({ vehicleNumber, phone }),
  });
}

async function guestPark(
  client: ApiClient,
  siteCode: string,
  vehicleNumber: string,
  phone: string,
): Promise<{ sessionToken: string; parking: { ticketCode: string; vehicleNumber: string; status: string } }> {
  const checkIn = await guestCheckIn(client, siteCode, vehicleNumber, phone);
  const looked = dataOf<{
    parkToken?: string;
    sessionToken?: string;
    alreadyParked?: boolean;
    parking?: { ticketCode: string; vehicleNumber: string; status: string };
  }>(checkIn.json);
  if (looked.sessionToken && looked.parking) {
    return { sessionToken: looked.sessionToken, parking: looked.parking };
  }
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

describe('B2C walk-in parking', () => {
  let sa: ApiClient;
  let b2c: B2cTenantFixture;
  let b2b: TenantFixture;
  let publicClient: ApiClient;

  beforeAll(async () => {
    await startTestServer();
    await cleanupTestData();
    const superAdmin = await createSuperAdmin();
    sa = new ApiClient();
    await sa.login(superAdmin.email, superAdmin.password);
    b2c = await createB2cTenant('b2c');
    b2b = await createTenant('b2b');
    publicClient = new ApiClient();
  });

  afterAll(async () => {
    await cleanupTestData();
    await stopTestServer();
  });

  it('onboarding defaults clientType to B2B and stores B2C when requested', async () => {
    const stamp = unique('onboard');
    const b2bOrg = await prisma.organization.create({
      data: {
        name: `Default ${stamp}`,
        companyName: `Default Co ${stamp}`,
        adminName: 'Admin',
        adminEmail: `default-${stamp}@wptest.local`,
      },
    });
    expect(b2bOrg.clientType).toBe('B2B');

    const listed = await sa.request(`/api/v1/organizations/${b2bOrg.id}`);
    expect(listed.status).toBe(200);
    expect(dataOf<{ clientType: string }>(listed.json).clientType).toBe('B2B');

    const b2cOrg = await prisma.organization.create({
      data: {
        name: `Walk-in ${stamp}`,
        companyName: `Walk-in Co ${stamp}`,
        adminName: 'Admin',
        adminEmail: `walkin-${stamp}@wptest.local`,
        clientType: 'B2C',
      },
    });
    const b2cListed = await sa.request(`/api/v1/organizations/${b2cOrg.id}`);
    expect(b2cListed.status).toBe(200);
    expect(dataOf<{ clientType: string }>(b2cListed.json).clientType).toBe('B2C');
  });

  it('rejects mixing B2B and B2C on the same site and a second B2C org', async () => {
    const mix = await sa.request(`/api/v1/organizations/${b2c.org.id}/sites/${b2b.site.id}`, {
      method: 'POST',
      body: JSON.stringify({ allocatedSpaces: 1 }),
    });
    expect(mix.status).toBe(400);

    const stamp = unique('b2c2');
    const secondOrg = await prisma.organization.create({
      data: {
        name: `Second B2C ${stamp}`,
        companyName: `Second Walk-in ${stamp}`,
        adminName: 'Admin',
        adminEmail: `second-b2c-${stamp}@wptest.local`,
        clientType: 'B2C',
      },
    });
    const second = await sa.request(`/api/v1/organizations/${secondOrg.id}/sites/${b2c.site.id}`, {
      method: 'POST',
      body: JSON.stringify({ allocatedSpaces: 1 }),
    });
    expect(second.status).toBe(400);
  });

  it('exposes parkingMode B2C on the public site and rejects lookup/register', async () => {
    const site = await publicClient.request(`/api/v1/public/parking/sites/${b2c.site.siteCode}`);
    expect(site.status).toBe(200);
    expect(dataOf<{ parkingMode: string }>(site.json).parkingMode).toBe('B2C');

    const lookup = await publicClient.request(`/api/v1/public/parking/sites/${b2c.site.siteCode}/lookup`, {
      method: 'POST',
      body: JSON.stringify({ vehicleNumber: 'WPTGUESTLOOK' }),
    });
    expect(lookup.status).toBe(400);

    const register = await publicClient.request(`/api/v1/public/parking/sites/${b2c.site.siteCode}/register`, {
      method: 'POST',
      body: JSON.stringify({
        vehicleNumber: 'WPTGUESTREG',
        employee: {
          name: 'Nope',
          email: 'nope@wptest.local',
          phone: '9000000001',
          employeeCode: 'X1',
          organizationId: b2c.org.id,
        },
      }),
    });
    expect(register.status).toBe(400);
  });

  it('rejects guest check-in on a B2B site', async () => {
    const res = await guestCheckIn(publicClient, b2b.site.siteCode, 'WPTB2BGUEST1', '9000000002');
    expect(res.status).toBe(400);
  });

  it('parks a guest, hides phone/email, and completes GET MY CAR', async () => {
    const plate = `WPTG${unique('pk').replace(/[^A-Z0-9]/gi, '').slice(-6)}`.slice(0, 12).toUpperCase();
    const parked = await guestPark(publicClient, b2c.site.siteCode, plate, '9000000010');
    expect(parked.parking.status).toBe('PARKED');
    expect(parked.parking.vehicleNumber).toBe(plate);
    expect(JSON.stringify(parked)).not.toMatch(/9000000010|@internal\.weepark/);

    const status = await publicClient.request('/api/v1/public/parking/session/status', {
      method: 'POST',
      body: JSON.stringify({ sessionToken: parked.sessionToken }),
    });
    expect(status.status).toBe(200);
    expect(dataOf<{ employeeName: string }>(status.json).employeeName).toBe('Guest');
    expect(JSON.stringify(status.json)).not.toMatch(/9000000010|@internal\.weepark/);

    const pickup = await requestPickup(
      publicClient,
      parked.sessionToken,
      parked.parking.vehicleNumber,
      parked.parking.ticketCode,
    );
    expect(pickup.status).toBe(201);
    const pickupId = dataOf<{ id: string }>(pickup.json).id;

    const valet = new ApiClient();
    await valet.login(b2c.valet.email, b2c.password);
    expect((await valet.request(`/api/v1/pickups/${pickupId}/accept`, { method: 'POST' })).status).toBe(200);
    expect((await valet.request(`/api/v1/pickups/${pickupId}/complete`, { method: 'POST' })).status).toBe(200);
  });

  it('notifies every valet assigned to the B2C site when a guest parks', async () => {
    const extra = await prisma.user.create({
      data: {
        name: 'Second B2C Valet',
        email: `b2c-valet-extra-${unique('bv')}@wptest.local`,
        passwordHash: await hash('TestPass1234'),
        role: 'VALET',
      },
    });
    await prisma.valetSiteAssignment.create({ data: { valetId: extra.id, siteId: b2c.site.id } });

    const plate = `WPTN${unique('bn').replace(/[^A-Z0-9]/gi, '').slice(-6)}`.slice(0, 12).toUpperCase();
    await guestPark(publicClient, b2c.site.siteCode, plate, '9000000060');

    const entry = await prisma.parkingEntry.findFirst({
      where: { vehicle: { vehicleNumber: plate } },
      select: { id: true },
    });
    expect(entry).toBeTruthy();

    const notes = await prisma.notification.findMany({ where: { type: 'VEHICLE_PARKED' } });
    const recipients = notes
      .filter((note) => (note.data as { parkingEntryId?: string } | null)?.parkingEntryId === entry?.id)
      .map((note) => note.userId);

    expect(recipients.sort()).toEqual([b2c.valet.id, extra.id].sort());
    expect(recipients).not.toContain(b2b.valet.id);
    expect(recipients).not.toContain(b2c.admin.id);
  });

  it('reuses the same guest for a return visit and rejects a different phone', async () => {
    const plate = `WPTR${unique('rv').replace(/[^A-Z0-9]/gi, '').slice(-6)}`.slice(0, 12).toUpperCase();
    const first = await guestPark(publicClient, b2c.site.siteCode, plate, '9000000020');
    const pickup = await requestPickup(
      publicClient,
      first.sessionToken,
      first.parking.vehicleNumber,
      first.parking.ticketCode,
    );
    const pickupId = dataOf<{ id: string }>(pickup.json).id;
    const valet = new ApiClient();
    await valet.login(b2c.valet.email, b2c.password);
    await valet.request(`/api/v1/pickups/${pickupId}/accept`, { method: 'POST' });
    await valet.request(`/api/v1/pickups/${pickupId}/complete`, { method: 'POST' });

    const again = await guestCheckIn(publicClient, b2c.site.siteCode, plate, '9000000020');
    expect([200, 201]).toContain(again.status);
    expect(dataOf<{ parkToken?: string }>(again.json).parkToken).toBeTruthy();

    const wrongPhone = await guestCheckIn(publicClient, b2c.site.siteCode, plate, '9000000021');
    expect(wrongPhone.status).toBe(409);
  });

  it('rejects a B2B-registered plate at a B2C site', async () => {
    const res = await guestCheckIn(publicClient, b2c.site.siteCode, b2b.vehicle.vehicleNumber, '9000000030');
    expect(res.status).toBe(409);
  });

  it('B2C org admin cannot create employees or vehicles and guests are hidden from lists', async () => {
    const admin = new ApiClient();
    await admin.login(b2c.admin.email, b2c.password);
    const me = await admin.request('/api/v1/auth/me');
    expect(dataOf<{ organizationClientType: string }>(me.json).organizationClientType).toBe('B2C');

    const createEmp = await admin.request('/api/v1/employees', {
      method: 'POST',
      body: JSON.stringify({
        employeeCode: 'E1',
        name: 'Should Fail',
        email: `fail-${unique('e')}@wptest.local`,
        organizationId: b2c.org.id,
      }),
    });
    expect(createEmp.status).toBe(403);

    const employees = await admin.request('/api/v1/employees');
    expect(employees.status).toBe(200);
    const empMeta = employees.json?.meta as { total?: number } | undefined;
    expect(empMeta?.total ?? 0).toBe(0);

    const vehicles = await admin.request('/api/v1/vehicles');
    expect(vehicles.status).toBe(200);
    const vehMeta = vehicles.json?.meta as { total?: number } | undefined;
    expect(vehMeta?.total ?? 0).toBe(0);

    const history = await admin.request('/api/v1/parking');
    expect(history.status).toBe(200);
  });

  it('B2C org admin history shows guest phone and can search by it', async () => {
    const phone = '9000000055';
    const plate = `WPTP${unique('ph').replace(/[^A-Z0-9]/gi, '').slice(-6)}`.slice(0, 12).toUpperCase();
    await guestPark(publicClient, b2c.site.siteCode, plate, phone);

    const admin = new ApiClient();
    await admin.login(b2c.admin.email, b2c.password);

    const history = await admin.request('/api/v1/parking');
    expect(history.status).toBe(200);
    const rows = dataOf<
      { vehicle: { vehicleNumber: string }; employee: { name: string; phone: string | null; isGuest: boolean } }[]
    >(history.json);
    const row = rows.find((entry) => entry.vehicle.vehicleNumber === plate);
    expect(row?.employee.name).toBe('Guest');
    expect(row?.employee.isGuest).toBe(true);
    expect(row?.employee.phone).toBe(phone);

    const searched = await admin.request(`/api/v1/parking?search=${phone}`);
    expect(searched.status).toBe(200);
    const matches = dataOf<{ vehicle: { vehicleNumber: string } }[]>(searched.json);
    expect(matches.some((entry) => entry.vehicle.vehicleNumber === plate)).toBe(true);
  });

  it('enforces allocated space capacity for guest parks', async () => {
    const tight = await createB2cTenant('cap', 1);
    const plateA = `WPTC${unique('ca').replace(/[^A-Z0-9]/gi, '').slice(-6)}`.slice(0, 12).toUpperCase();
    const plateB = `WPTC${unique('cb').replace(/[^A-Z0-9]/gi, '').slice(-6)}`.slice(0, 12).toUpperCase();
    await guestPark(publicClient, tight.site.siteCode, plateA, '9000000040');
    const second = await guestPark(publicClient, tight.site.siteCode, plateB, '9000000041').catch((error: Error) => error);
    if (second instanceof Error) {
      expect(second.message).toMatch(/409|allocated|full/i);
    } else {
      throw new Error('Expected second guest park to fail at capacity');
    }
  });
});
