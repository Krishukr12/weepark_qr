import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { parkingRepository } from '../../src/repositories/parking.repository';
import {
  ApiClient,
  cleanupTestData,
  createSuperAdmin,
  createTenant,
  dataOf,
  lookupAndPark,
  requestPickup,
  startTestServer,
  stopTestServer,
} from '../helpers';

describe('batched site occupancy and dashboard aggregates', () => {
  beforeAll(async () => {
    await startTestServer();
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await stopTestServer();
  });

  it('site list occupancy matches per-site active counts after a park', async () => {
    const tenant = await createTenant('occ');
    const other = await createTenant('occb');
    const publicClient = new ApiClient();
    await lookupAndPark(publicClient, tenant.site.siteCode, tenant.vehicle.vehicleNumber);

    const [directA, directB, batched] = await Promise.all([
      parkingRepository.countActiveInSite(tenant.site.id),
      parkingRepository.countActiveInSite(other.site.id),
      parkingRepository.countActiveBySiteIds([tenant.site.id, other.site.id, other.otherSite.id]),
    ]);
    expect(directA).toBe(1);
    expect(directB).toBe(0);
    expect(batched.get(tenant.site.id)).toBe(1);
    expect(batched.get(other.site.id) ?? 0).toBe(0);

    const sa = await createSuperAdmin();
    const admin = new ApiClient();
    await admin.login(sa.email, sa.password);
    const listed = await admin.request('/api/v1/sites?page=1&limit=100');
    expect(listed.status).toBe(200);
    const rows = dataOf<{ id: string; occupancy: { occupied: number; totalCapacity: number } }[]>(listed.json);
    const parkedSite = rows.find((site) => site.id === tenant.site.id);
    const idleSite = rows.find((site) => site.id === other.site.id);
    expect(parkedSite?.occupancy.occupied).toBe(directA);
    expect(idleSite?.occupancy.occupied).toBe(directB);

    const orgList = await admin.request('/api/v1/organizations?page=1&limit=10');
    expect(orgList.status).toBe(200);
    const orgs = dataOf<{ id: string; _count: { employees: number; parkingEntries: number } }[]>(orgList.json);
    const parkedOrg = orgs.find((org) => org.id === tenant.org.id);
    expect(parkedOrg?._count.parkingEntries).toBe(1);
  });

  it('batched occupancy is empty for no site ids', async () => {
    const empty = await parkingRepository.countActiveBySiteIds([]);
    expect(empty.size).toBe(0);
    const emptyOrg = await parkingRepository.countActiveByOrgInSiteIds('cnotarealorganizationidxx', []);
    expect(emptyOrg.size).toBe(0);
  });

  it('dashboard trend and peak-hours return full buckets without loading raw rows', async () => {
    const sa = await createSuperAdmin();
    const admin = new ApiClient();
    await admin.login(sa.email, sa.password);

    const trend = await admin.request('/api/v1/dashboard/parking-trend?days=14');
    expect(trend.status).toBe(200);
    const points = dataOf<{ date: string; parkings: number; pickups: number }[]>(trend.json);
    expect(points).toHaveLength(14);
    expect(points.every((p) => typeof p.parkings === 'number' && typeof p.pickups === 'number')).toBe(true);
    expect(points.reduce((sum, p) => sum + p.parkings, 0)).toBeGreaterThanOrEqual(1);

    const peak = await admin.request('/api/v1/dashboard/peak-hours');
    expect(peak.status).toBe(200);
    const hours = dataOf<{ hour: string; count: number }[]>(peak.json);
    expect(hours).toHaveLength(24);
    expect(hours[0].hour).toBe('00:00');
    expect(hours[23].hour).toBe('23:00');
  });

  it('org-admin site list occupancy matches the org slice count', async () => {
    const tenant = await createTenant('orgocc');
    const publicClient = new ApiClient();
    await lookupAndPark(publicClient, tenant.site.siteCode, tenant.vehicle.vehicleNumber);

    const byOrg = await parkingRepository.countActiveByOrgInSiteIds(tenant.org.id, [tenant.site.id]);
    expect(byOrg.get(tenant.site.id)).toBe(1);

    const admin = new ApiClient();
    await admin.login(tenant.admin.email, tenant.password);
    const listed = await admin.request('/api/v1/sites?page=1&limit=100');
    expect(listed.status).toBe(200);
    const rows = dataOf<
      { id: string; occupancy: { occupied: number }; orgAllocation?: { occupied: number; allocatedSpaces: number } | null }[]
    >(listed.json);
    const site = rows.find((row) => row.id === tenant.site.id);
    expect(site?.occupancy.occupied).toBe(1);
    expect(site?.orgAllocation?.occupied).toBe(1);
  });

  it('completed visits drop out of active occupancy and org parked count', async () => {
    const tenant = await createTenant('occdone');
    const publicClient = new ApiClient();
    const parked = await lookupAndPark(publicClient, tenant.site.siteCode, tenant.vehicle.vehicleNumber);
    const pickup = await requestPickup(
      publicClient,
      parked.sessionToken,
      parked.parking.vehicleNumber,
      parked.parking.ticketCode,
    );
    const pickupId = dataOf<{ id: string }>(pickup.json).id;
    const valet = new ApiClient();
    await valet.login(tenant.valet.email, tenant.password);
    expect((await valet.request(`/api/v1/pickups/${pickupId}/accept`, { method: 'POST' })).status).toBe(200);
    expect((await valet.request(`/api/v1/pickups/${pickupId}/complete`, { method: 'POST' })).status).toBe(200);

    expect(await parkingRepository.countActiveInSite(tenant.site.id)).toBe(0);
    const batched = await parkingRepository.countActiveBySiteIds([tenant.site.id]);
    expect(batched.get(tenant.site.id) ?? 0).toBe(0);

    const sa = await createSuperAdmin();
    const admin = new ApiClient();
    await admin.login(sa.email, sa.password);
    const orgList = await admin.request('/api/v1/organizations?page=1&limit=50');
    const orgs = dataOf<{ id: string; _count: { parkingEntries: number } }[]>(orgList.json);
    expect(orgs.find((org) => org.id === tenant.org.id)?._count.parkingEntries).toBe(0);
  });
});
