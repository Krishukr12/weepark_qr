import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { io as ioc, type Socket } from 'socket.io-client';
import { signAccessToken } from '../../src/utils/token';
import {
  ApiClient,
  baseUrl,
  cleanupTestData,
  createTenant,
  dataOf,
  hash,
  lookupAndPark,
  requestPickup,
  startTestServer,
  stopTestServer,
  unique,
  type TenantFixture,
} from '../helpers';
import { prisma } from '../../src/config/prisma';

function connect(token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = ioc(baseUrl, { auth: { token }, transports: ['websocket'] });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (err) => reject(err));
  });
}

describe('Socket.IO authorization', () => {
  let tenantA: TenantFixture;
  let tenantB: TenantFixture;

  beforeAll(async () => {
    await startTestServer();
    await cleanupTestData();
    tenantA = await createTenant('socka');
    tenantB = await createTenant('sockb');
  });

  afterAll(async () => {
    await cleanupTestData();
    await stopTestServer();
  });

  it('rejects a missing or invalid token', async () => {
    await expect(connect('')).rejects.toBeTruthy();
    await expect(connect('not-a-jwt')).rejects.toBeTruthy();
  });

  it('lets a valet join an assigned site and denies a foreign site', async () => {
    const token = signAccessToken({ sub: tenantA.valet.id, role: 'VALET', organizationId: null });
    const socket = await connect(token);
    const denied = await new Promise<boolean>((resolve) => {
      socket.once('join:site:denied', () => resolve(true));
      socket.emit('join:site', tenantB.site.id);
      setTimeout(() => resolve(false), 400);
    });
    expect(denied).toBe(true);
    socket.disconnect();
  });

  it('does not deliver site events to an unauthorized valet', async () => {
    const tokenA = signAccessToken({ sub: tenantA.valet.id, role: 'VALET', organizationId: null });
    const tokenB = signAccessToken({ sub: tenantB.valet.id, role: 'VALET', organizationId: null });
    const a = await connect(tokenA);
    const b = await connect(tokenB);
    a.emit('join:site', tenantA.site.id);
    b.emit('join:site', tenantA.site.id);
    await new Promise((r) => setTimeout(r, 200));

    let leaked = false;
    b.on('site:event', () => {
      leaked = true;
    });
    b.on('notification', () => {
      leaked = true;
    });

    let delivered = false;
    a.on('notification', () => {
      delivered = true;
    });
    a.on('site:event', () => {
      delivered = true;
    });

    const publicClient = new ApiClient();
    const parked = await lookupAndPark(publicClient, tenantA.site.siteCode, tenantA.vehicle.vehicleNumber);
    await requestPickup(
      publicClient,
      parked.sessionToken,
      parked.parking.vehicleNumber,
      parked.parking.ticketCode,
    );
    await new Promise((r) => setTimeout(r, 400));

    a.disconnect();
    b.disconnect();
    expect(leaked).toBe(false);
    expect(delivered).toBe(true);
  });
});

describe('notifications and dashboard isolation', () => {
  let tenantA: TenantFixture;
  let tenantB: TenantFixture;

  beforeAll(async () => {
    await startTestServer();
    tenantA = await createTenant('nota');
    tenantB = await createTenant('notb');
  });

  afterAll(async () => {
    await cleanupTestData();
    await stopTestServer();
  });

  it('unreadOnly list hides notifications the user has already read', async () => {
    const admin = new ApiClient();
    await admin.login(tenantA.admin.email, tenantA.password);
    const { prisma } = await import('../../src/config/prisma');
    const unread = await prisma.notification.create({
      data: {
        userId: tenantA.admin.id,
        type: 'SYSTEM',
        title: 'Unread item',
        message: 'Show in navbar',
      },
    });
    const read = await prisma.notification.create({
      data: {
        userId: tenantA.admin.id,
        type: 'SYSTEM',
        title: 'Already read',
        message: 'Hide from navbar',
        isRead: true,
      },
    });

    const all = await admin.request('/api/v1/notifications?limit=50');
    expect(all.status).toBe(200);
    const allIds = dataOf<{ id: string }[]>(all.json).map((n) => n.id);
    expect(allIds).toEqual(expect.arrayContaining([unread.id, read.id]));

    const unreadOnly = await admin.request('/api/v1/notifications?unreadOnly=true&limit=50');
    expect(unreadOnly.status).toBe(200);
    const unreadIds = dataOf<{ id: string }[]>(unreadOnly.json).map((n) => n.id);
    expect(unreadIds).toContain(unread.id);
    expect(unreadIds).not.toContain(read.id);

    await admin.request(`/api/v1/notifications/${unread.id}/read`, { method: 'POST', body: '{}' });
    const afterRead = await admin.request('/api/v1/notifications?unreadOnly=true&limit=50');
    expect(dataOf<{ id: string }[]>(afterRead.json).map((n) => n.id)).not.toContain(unread.id);
  });

  it('vehicle parked notification includes parkingEntryId for opening the row', async () => {
    const token = signAccessToken({ sub: tenantA.valet.id, role: 'VALET', organizationId: null });
    const socket = await connect(token);
    const received = new Promise<{ type: string; data: { parkingEntryId?: string; siteId?: string } | null }>(
      (resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timed out waiting for VEHICLE_PARKED')), 4000);
        socket.on('notification', (payload: { type: string; data: { parkingEntryId?: string; siteId?: string } | null }) => {
          if (payload.type === 'VEHICLE_PARKED') {
            clearTimeout(timer);
            resolve(payload);
          }
        });
      },
    );

    const publicClient = new ApiClient();
    await lookupAndPark(publicClient, tenantA.site.siteCode, tenantA.vehicle.vehicleNumber);
    const payload = await received;
    expect(payload.data?.parkingEntryId).toMatch(/^c/i);
    expect(payload.data?.siteId).toBe(tenantA.site.id);
    socket.disconnect();
  });

  it('stores VEHICLE_PARKED for every valet assigned to the site, not other sites', async () => {
    const extra = await prisma.user.create({
      data: {
        name: 'Second Site Valet',
        email: `valet-extra-${unique('sv')}@wptest.local`,
        passwordHash: await hash('TestPass1234'),
        role: 'VALET',
      },
    });
    await prisma.valetSiteAssignment.create({ data: { valetId: extra.id, siteId: tenantA.site.id } });

    const plate = `WPTN${unique('np').replace(/[^A-Z0-9]/gi, '').slice(-6)}`.slice(0, 12).toUpperCase();
    await prisma.vehicle.create({
      data: { vehicleNumber: plate, vehicleType: 'CAR', employeeId: tenantA.employee.id },
    });

    const publicClient = new ApiClient();
    await lookupAndPark(publicClient, tenantA.site.siteCode, plate);

    const entry = await prisma.parkingEntry.findFirst({
      where: { vehicle: { vehicleNumber: plate } },
      select: { id: true },
    });
    expect(entry).toBeTruthy();

    const notes = await prisma.notification.findMany({
      where: { type: 'VEHICLE_PARKED' },
    });
    const recipients = notes
      .filter((note) => (note.data as { parkingEntryId?: string } | null)?.parkingEntryId === entry?.id)
      .map((note) => note.userId);

    expect(recipients.sort()).toEqual([tenantA.valet.id, extra.id].sort());
    expect(recipients).not.toContain(tenantA.otherValet.id);
    expect(recipients).not.toContain(tenantA.admin.id);
  });

  it('delivers PICKUP_REQUESTED then PICKUP_ACCEPTED to assigned valets', async () => {
    const plate = `WPTP${unique('pu').replace(/[^A-Z0-9]/gi, '').slice(-6)}`.slice(0, 12).toUpperCase();
    await prisma.vehicle.create({
      data: { vehicleNumber: plate, vehicleType: 'CAR', employeeId: tenantA.employee.id },
    });

    const token = signAccessToken({ sub: tenantA.valet.id, role: 'VALET', organizationId: null });
    const socket = await connect(token);
    const requested = new Promise<{ type: string; data: { pickupRequestId?: string } | null }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out waiting for PICKUP_REQUESTED')), 4000);
      socket.on('notification', (payload: { type: string; data: { pickupRequestId?: string } | null }) => {
        if (payload.type === 'PICKUP_REQUESTED') {
          clearTimeout(timer);
          resolve(payload);
        }
      });
    });

    const publicClient = new ApiClient();
    const parked = await lookupAndPark(publicClient, tenantA.site.siteCode, plate);
    const pickupRes = await requestPickup(
      publicClient,
      parked.sessionToken,
      parked.parking.vehicleNumber,
      parked.parking.ticketCode,
    );
    expect(pickupRes.status).toBe(201);
    const pickupId = dataOf<{ id: string }>(pickupRes.json).id;
    const payload = await requested;
    expect(payload.data?.pickupRequestId).toBe(pickupId);

    const accepted = new Promise<{ type: string }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out waiting for PICKUP_ACCEPTED')), 4000);
      socket.on('notification', (note: { type: string }) => {
        if (note.type === 'PICKUP_ACCEPTED') {
          clearTimeout(timer);
          resolve(note);
        }
      });
    });

    const valet = new ApiClient();
    await valet.login(tenantA.valet.email, tenantA.password);
    expect((await valet.request(`/api/v1/pickups/${pickupId}/accept`, { method: 'POST', body: '{}' })).status).toBe(200);
    await accepted;
    socket.disconnect();
  });

  it('read-all is not captured by :id/read', async () => {
    const admin = new ApiClient();
    await admin.login(tenantA.admin.email, tenantA.password);
    const { prisma } = await import('../../src/config/prisma');
    await prisma.notification.create({
      data: {
        userId: tenantA.admin.id,
        type: 'SYSTEM',
        title: 'Hello',
        message: 'Test',
      },
    });
    const res = await admin.request('/api/v1/notifications/read-all', { method: 'POST', body: '{}' });
    expect(res.status).toBe(200);
    const count = await admin.request('/api/v1/notifications/unread-count');
    expect(dataOf<{ count: number }>(count.json).count).toBe(0);
  });

  it('cannot mark another user notification as read in a way that affects them', async () => {
    const { prisma } = await import('../../src/config/prisma');
    const note = await prisma.notification.create({
      data: {
        userId: tenantB.admin.id,
        type: 'SYSTEM',
        title: 'Secret',
        message: 'Not yours',
      },
    });
    const adminA = new ApiClient();
    await adminA.login(tenantA.admin.email, tenantA.password);
    await adminA.request(`/api/v1/notifications/${note.id}/read`, { method: 'POST', body: '{}' });
    const still = await prisma.notification.findUnique({ where: { id: note.id } });
    expect(still?.isRead).toBe(false);
  });

  it('valet dashboard zeros global org/employee/vehicle counts', async () => {
    const valet = new ApiClient();
    await valet.login(tenantA.valet.email, tenantA.password);
    const res = await valet.request('/api/v1/dashboard/stats');
    expect(res.status).toBe(200);
    const stats = dataOf<{ organizations: number; employees: number; vehicles: number; valets: number }>(res.json);
    expect(stats.organizations).toBe(0);
    expect(stats.employees).toBe(0);
    expect(stats.vehicles).toBe(0);
    expect(stats.valets).toBe(0);
  });

  it('org admin dashboard is reachable', async () => {
    const admin = new ApiClient();
    await admin.login(tenantA.admin.email, tenantA.password);
    const res = await admin.request('/api/v1/dashboard/stats');
    expect(res.status).toBe(200);
    const stats = dataOf<{ employees: number; vehicles: number }>(res.json);
    expect(stats.employees).toBeGreaterThanOrEqual(1);
    expect(stats.vehicles).toBeGreaterThanOrEqual(1);
  });
});
