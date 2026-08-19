import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { io as ioc, type Socket } from 'socket.io-client';
import { signAccessToken } from '../../src/utils/token';
import {
  ApiClient,
  baseUrl,
  cleanupTestData,
  createTenant,
  dataOf,
  lookupAndPark,
  requestPickup,
  startTestServer,
  stopTestServer,
  type TenantFixture,
} from '../helpers';

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
