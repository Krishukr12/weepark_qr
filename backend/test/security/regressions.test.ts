import { afterAll, beforeAll, describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { prisma } from '../../src/config/prisma';
import { canJoinSite } from '../../src/sockets/socket';
import {
  ApiClient,
  cleanupTestData,
  createSuperAdmin,
  createTenant,
  dataOf,
  startTestServer,
  stopTestServer,
  type TenantFixture,
} from '../helpers';

describe('WeePark security regressions', () => {
  let tenantA: TenantFixture;
  let tenantB: TenantFixture;
  let superAdmin: { email: string; password: string };

  beforeAll(async () => {
    await startTestServer();
    await cleanupTestData();
    superAdmin = await createSuperAdmin();
    tenantA = await createTenant('a');
    tenantB = await createTenant('b');
  });

  afterAll(async () => {
    await cleanupTestData();
    await stopTestServer();
    await prisma.$disconnect();
  });

  describe('authentication', () => {
    it('logs in with valid credentials and does not return a refresh token in JSON', async () => {
      const client = new ApiClient();
      const result = await client.login(tenantA.admin.email, tenantA.password);
      assert.equal(result.status, 200);
      const data = dataOf<{ accessToken: string; refreshToken?: string; user: { email: string } }>(result.json);
      assert.ok(data.accessToken);
      assert.equal(data.refreshToken, undefined);
      assert.equal(data.user.email, tenantA.admin.email);
      assert.ok(client.cookies.get('weepark_refresh'));
    });

    it('rejects a wrong password', async () => {
      const client = new ApiClient();
      const result = await client.login(tenantA.admin.email, 'WrongPass1234');
      assert.equal(result.status, 401);
    });

    it('rejects an inactive user', async () => {
      await prisma.user.update({ where: { id: tenantA.admin.id }, data: { isActive: false } });
      const client = new ApiClient();
      const result = await client.login(tenantA.admin.email, tenantA.password);
      assert.equal(result.status, 403);
      await prisma.user.update({ where: { id: tenantA.admin.id }, data: { isActive: true } });
    });

    it('rotates the refresh cookie and rejects reuse of the previous token', async () => {
      const client = new ApiClient();
      await client.login(tenantA.admin.email, tenantA.password);
      const first = client.cookies.get('weepark_refresh');
      assert.ok(first);

      const refreshed = await client.request('/api/v1/auth/refresh', { method: 'POST', body: '{}' });
      assert.equal(refreshed.status, 200);
      const second = client.cookies.get('weepark_refresh');
      assert.ok(second);
      assert.notEqual(second, first);

      const reuse = new ApiClient();
      reuse.cookies.set('weepark_refresh', first!);
      const reused = await reuse.request('/api/v1/auth/refresh', { method: 'POST', body: '{}' });
      assert.equal(reused.status, 401);

      const afterReuse = await client.request('/api/v1/auth/refresh', { method: 'POST', body: '{}' });
      assert.equal(afterReuse.status, 401);
    });

    it('revokes sessions on password change', async () => {
      const client = new ApiClient();
      await client.login(tenantA.admin.email, tenantA.password);
      const changed = await client.request('/api/v1/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: tenantA.password, newPassword: 'NewPass1234' }),
      });
      assert.equal(changed.status, 200);

      const refresh = await client.request('/api/v1/auth/refresh', { method: 'POST', body: '{}' });
      assert.equal(refresh.status, 401);

      const relogin = new ApiClient();
      const back = await relogin.login(tenantA.admin.email, 'NewPass1234');
      assert.equal(back.status, 200);
      await relogin.request('/api/v1/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: 'NewPass1234', newPassword: tenantA.password }),
      });
    });
  });

  describe('public QR authorization', () => {
    it('lookup never returns employee email or phone', async () => {
      const client = new ApiClient();
      const result = await client.request(`/api/v1/public/parking/sites/${tenantA.site.siteCode}/lookup`, {
        method: 'POST',
        body: JSON.stringify({ vehicleNumber: tenantA.vehicle.vehicleNumber }),
      });
      assert.equal(result.status, 200);
      const raw = JSON.stringify(result.json);
      assert.equal(raw.includes(tenantA.employee.email), false);
      assert.equal(raw.includes('9876543210'), false);
      const data = dataOf<{ found: boolean; parkToken?: string; display?: { employeeName: string } }>(result.json);
      assert.equal(data.found, true);
      assert.ok(data.parkToken);
      assert.ok(data.display?.employeeName);
    });

    it('rejects parking with a raw vehicleId', async () => {
      const client = new ApiClient();
      const result = await client.request(`/api/v1/public/parking/sites/${tenantA.site.siteCode}/park`, {
        method: 'POST',
        body: JSON.stringify({ vehicleId: tenantA.vehicle.id }),
      });
      assert.equal(result.status, 400);
    });

    it('rejects pickup with a raw parkingEntryId', async () => {
      const client = new ApiClient();
      const result = await client.request('/api/v1/public/pickups/request', {
        method: 'POST',
        body: JSON.stringify({ parkingEntryId: 'clxxxxxxxxxxxxxxxxxxxxxxx' }),
      });
      assert.equal(result.status, 400);
    });

    it('rejects GET of an arbitrary parking entry on the old public path', async () => {
      const client = new ApiClient();
      const result = await client.request('/api/v1/public/parking/entries/clxxxxxxxxxxxxxxxxxxxxxxx');
      assert.equal(result.status, 404);
    });

    it('does not list every organization without a siteCode', async () => {
      const client = new ApiClient();
      const missing = await client.request('/api/v1/public/organizations');
      assert.equal(missing.status, 400);
      const scoped = await client.request(`/api/v1/public/organizations?siteCode=${tenantA.site.siteCode}`);
      assert.equal(scoped.status, 200);
      const orgs = dataOf<{ id: string }[]>(scoped.json);
      assert.ok(orgs.some((o) => o.id === tenantA.org.id));
      assert.equal(orgs.some((o) => o.id === tenantB.org.id), false);
    });

    it('cannot park using another vehicle’s authorization token at a different site', async () => {
      const client = new ApiClient();
      const lookup = await client.request(`/api/v1/public/parking/sites/${tenantA.site.siteCode}/lookup`, {
        method: 'POST',
        body: JSON.stringify({ vehicleNumber: tenantA.vehicle.vehicleNumber }),
      });
      const parkToken = dataOf<{ parkToken: string }>(lookup.json).parkToken;
      const result = await client.request(`/api/v1/public/parking/sites/${tenantB.site.siteCode}/park`, {
        method: 'POST',
        body: JSON.stringify({ parkToken }),
      });
      assert.ok(result.status === 403 || result.status === 400);
    });

    it('cannot request pickup for another session', async () => {
      const client = new ApiClient();
      const lookupA = await client.request(`/api/v1/public/parking/sites/${tenantA.site.siteCode}/lookup`, {
        method: 'POST',
        body: JSON.stringify({ vehicleNumber: tenantA.vehicle.vehicleNumber }),
      });
      const parkA = await client.request(`/api/v1/public/parking/sites/${tenantA.site.siteCode}/park`, {
        method: 'POST',
        body: JSON.stringify({ parkToken: dataOf<{ parkToken: string }>(lookupA.json).parkToken }),
      });
      assert.equal(parkA.status, 201);
      const sessionA = dataOf<{ sessionToken: string; parking: { ticketCode: string; vehicleNumber: string } }>(
        parkA.json,
      );

      const lookupB = await client.request(`/api/v1/public/parking/sites/${tenantB.site.siteCode}/lookup`, {
        method: 'POST',
        body: JSON.stringify({ vehicleNumber: tenantB.vehicle.vehicleNumber }),
      });
      const parkB = await client.request(`/api/v1/public/parking/sites/${tenantB.site.siteCode}/park`, {
        method: 'POST',
        body: JSON.stringify({ parkToken: dataOf<{ parkToken: string }>(lookupB.json).parkToken }),
      });
      assert.equal(parkB.status, 201);
      const sessionB = dataOf<{ sessionToken: string; parking: { ticketCode: string; vehicleNumber: string } }>(
        parkB.json,
      );

      const steal = await client.request('/api/v1/public/pickups/request', {
        method: 'POST',
        body: JSON.stringify({
          sessionToken: sessionA.sessionToken,
          vehicleNumber: sessionB.parking.vehicleNumber,
          ticketCode: sessionB.parking.ticketCode,
        }),
      });
      assert.equal(steal.status, 403);
    });

    it('valet from another site cannot accept a pickup', async () => {
      const publicClient = new ApiClient();
      const lookup = await publicClient.request(`/api/v1/public/parking/sites/${tenantA.site.siteCode}/lookup`, {
        method: 'POST',
        body: JSON.stringify({ vehicleNumber: tenantA.vehicle.vehicleNumber }),
      });
      const looked = dataOf<{ parkToken?: string; sessionToken?: string; parking?: { ticketCode: string } }>(
        lookup.json,
      );
      let sessionToken = looked.sessionToken;
      let ticketCode = looked.parking?.ticketCode;
      if (looked.parkToken) {
        const parked = await publicClient.request(`/api/v1/public/parking/sites/${tenantA.site.siteCode}/park`, {
          method: 'POST',
          body: JSON.stringify({ parkToken: looked.parkToken }),
        });
        const created = dataOf<{ sessionToken: string; parking: { ticketCode: string } }>(parked.json);
        sessionToken = created.sessionToken;
        ticketCode = created.parking.ticketCode;
      }
      assert.ok(sessionToken && ticketCode);

      const requested = await publicClient.request('/api/v1/public/pickups/request', {
        method: 'POST',
        body: JSON.stringify({
          sessionToken,
          vehicleNumber: tenantA.vehicle.vehicleNumber,
          ticketCode,
        }),
      });
      assert.ok(requested.status === 201 || requested.status === 409);
      const pickup = await prisma.pickupRequest.findFirst({
        where: { parkingEntry: { vehicleId: tenantA.vehicle.id } },
        orderBy: { requestedAt: 'desc' },
      });
      assert.ok(pickup);

      const foreignValet = new ApiClient();
      await foreignValet.login(tenantA.otherValet.email, tenantA.password);
      const accept = await foreignValet.request(`/api/v1/pickups/${pickup!.id}/accept`, { method: 'POST' });
      assert.equal(accept.status, 403);

      const homeValet = new ApiClient();
      await homeValet.login(tenantA.valet.email, tenantA.password);
      const ok = await homeValet.request(`/api/v1/pickups/${pickup!.id}/accept`, { method: 'POST' });
      if (pickup!.status === 'PENDING') {
        assert.equal(ok.status, 200);
        const complete = await homeValet.request(`/api/v1/pickups/${pickup!.id}/complete`, { method: 'POST' });
        assert.equal(complete.status, 200);
      }
    });

    it('rejects parking when the vehicle is inactive', async () => {
      await prisma.vehicle.update({ where: { id: tenantA.vehicle.id }, data: { isActive: false } });
      const client = new ApiClient();
      const lookup = await client.request(`/api/v1/public/parking/sites/${tenantA.site.siteCode}/lookup`, {
        method: 'POST',
        body: JSON.stringify({ vehicleNumber: tenantA.vehicle.vehicleNumber }),
      });
      const data = dataOf<{ parkToken?: string; canParkAtSite: boolean }>(lookup.json);
      assert.equal(data.canParkAtSite, false);
      assert.equal(data.parkToken, undefined);
      await prisma.vehicle.update({ where: { id: tenantA.vehicle.id }, data: { isActive: true } });
    });
  });

  describe('tenant isolation', () => {
    it('ORG_ADMIN A cannot read Organization B parking by id', async () => {
      const publicClient = new ApiClient();
      const lookup = await publicClient.request(`/api/v1/public/parking/sites/${tenantB.site.siteCode}/lookup`, {
        method: 'POST',
        body: JSON.stringify({ vehicleNumber: tenantB.vehicle.vehicleNumber }),
      });
      let parkToken = dataOf<{ parkToken?: string; alreadyParked?: boolean; sessionToken?: string }>(lookup.json)
        .parkToken;
      if (!parkToken) {
        const existing = await prisma.parkingEntry.findFirst({
          where: { vehicleId: tenantB.vehicle.id, status: { in: ['PARKED', 'PICKUP_REQUESTED', 'PICKUP_IN_PROGRESS'] } },
        });
        assert.ok(existing);
      } else {
        await publicClient.request(`/api/v1/public/parking/sites/${tenantB.site.siteCode}/park`, {
          method: 'POST',
          body: JSON.stringify({ parkToken }),
        });
      }
      const entry = await prisma.parkingEntry.findFirst({
        where: { vehicleId: tenantB.vehicle.id },
        orderBy: { createdAt: 'desc' },
      });
      assert.ok(entry);

      const adminA = new ApiClient();
      await adminA.login(tenantA.admin.email, tenantA.password);
      const result = await adminA.request(`/api/v1/parking/${entry!.id}`);
      assert.ok(result.status === 403 || result.status === 404);
    });

    it('ORG_ADMIN A cannot list Organization B pickups', async () => {
      const adminA = new ApiClient();
      await adminA.login(tenantA.admin.email, tenantA.password);
      const listed = await adminA.request('/api/v1/pickups');
      assert.equal(listed.status, 200);
      const items = dataOf<{ parkingEntry: { organization: { id: string } } }[]>(listed.json) ?? [];
      for (const item of items) {
        assert.equal(item.parkingEntry.organization.id, tenantA.org.id);
      }
    });
  });

  describe('socket ACL', () => {
    it('valet A cannot join site B', async () => {
      const allowed = await canJoinSite(
        { sub: tenantA.valet.id, role: 'VALET', organizationId: null },
        tenantB.site.id,
      );
      assert.equal(allowed, false);
    });

    it('org admin can join an assigned site and not a foreign site', async () => {
      const own = await canJoinSite(
        { sub: tenantA.admin.id, role: 'ORG_ADMIN', organizationId: tenantA.org.id },
        tenantA.site.id,
      );
      const foreign = await canJoinSite(
        { sub: tenantA.admin.id, role: 'ORG_ADMIN', organizationId: tenantA.org.id },
        tenantB.site.id,
      );
      assert.equal(own, true);
      assert.equal(foreign, false);
    });
  });

  describe('validation', () => {
    it('rejects a string capacity on site create', async () => {
      const admin = new ApiClient();
      await admin.login(superAdmin.email, superAdmin.password);
      const asString = await admin.request('/api/v1/sites', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Bad Capacity',
          address: '12 Test Street, Bengaluru',
          totalCapacity: '100',
        }),
      });
      assert.equal(asString.status, 400);

      const asAbc = await admin.request('/api/v1/sites', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Bad Capacity 2',
          address: '12 Test Street, Bengaluru',
          totalCapacity: 'abc',
        }),
      });
      assert.equal(asAbc.status, 400);

      const badId = await admin.request('/api/v1/parking/not-a-cuid');
      assert.equal(badId.status, 400);
    });
  });

  describe('parking integrity', () => {
    it('concurrent park requests cannot create two active sessions', async () => {
      const stamp = `WPTC${Date.now().toString(36)}`.slice(0, 12).toUpperCase();
      const employee = await prisma.employee.create({
        data: {
          employeeCode: `EMP-C-${stamp}`,
          name: 'Concurrent Emp',
          email: `conc-${stamp}@wptest.local`,
          organizationId: tenantA.org.id,
        },
      });
      const vehicle = await prisma.vehicle.create({
        data: { vehicleNumber: stamp, vehicleType: 'CAR', employeeId: employee.id },
      });

      const client = new ApiClient();
      const lookup = await client.request(`/api/v1/public/parking/sites/${tenantA.site.siteCode}/lookup`, {
        method: 'POST',
        body: JSON.stringify({ vehicleNumber: stamp }),
      });
      const parkToken = dataOf<{ parkToken: string }>(lookup.json).parkToken;
      assert.ok(parkToken);

      const [a, b] = await Promise.all([
        client.request(`/api/v1/public/parking/sites/${tenantA.site.siteCode}/park`, {
          method: 'POST',
          body: JSON.stringify({ parkToken }),
        }),
        client.request(`/api/v1/public/parking/sites/${tenantA.site.siteCode}/park`, {
          method: 'POST',
          body: JSON.stringify({ parkToken }),
        }),
      ]);
      const statuses = [a.status, b.status].sort();
      assert.equal(statuses[0], 201);
      assert.ok(statuses[1] === 409 || statuses[1] === 400);

      const active = await prisma.parkingEntry.count({
        where: { vehicleId: vehicle.id, status: { in: ['PARKED', 'PICKUP_REQUESTED', 'PICKUP_IN_PROGRESS'] } },
      });
      assert.equal(active, 1);
    });
  });
});
