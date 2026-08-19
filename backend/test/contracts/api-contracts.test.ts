import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  ApiClient,
  cleanupTestData,
  createSuperAdmin,
  createTenant,
  dataOf,
  lookupAndPark,
  startTestServer,
  stopTestServer,
} from '../helpers';

const envelope = z.object({
  success: z.literal(true),
  data: z.unknown(),
});

const userContract = z.object({
  id: z.string(),
  email: z.string().email(),
  role: z.enum(['SUPER_ADMIN', 'ORG_ADMIN', 'VALET', 'EMPLOYEE']),
  isActive: z.boolean(),
});

const lookupContract = z.object({
  found: z.boolean(),
  canParkAtSite: z.boolean(),
  alreadyParked: z.boolean(),
  vehicleNumber: z.string(),
  site: z.object({ name: z.string(), siteCode: z.string() }),
});

const parkingStatusContract = z.object({
  ticketCode: z.string(),
  status: z.enum(['PARKED', 'PICKUP_REQUESTED', 'PICKUP_IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
  parkedAt: z.string(),
  vehicleNumber: z.string(),
  employeeName: z.string(),
  organizationName: z.string(),
  siteName: z.string(),
  siteCode: z.string(),
});

const dashboardContract = z.object({
  todaysParking: z.number(),
  currentParked: z.number(),
  employees: z.number(),
  vehicles: z.number(),
  organizations: z.number(),
});

describe('API contracts', () => {
  let admin: ApiClient;
  let publicClient: ApiClient;
  let siteCode = '';
  let vehicleNumber = '';

  beforeAll(async () => {
    await startTestServer();
    await cleanupTestData();
    const superAdmin = await createSuperAdmin();
    const tenant = await createTenant('ctr');
    siteCode = tenant.site.siteCode;
    vehicleNumber = tenant.vehicle.vehicleNumber;
    admin = new ApiClient();
    publicClient = new ApiClient();
    await admin.login(superAdmin.email, superAdmin.password);
  });

  afterAll(async () => {
    await cleanupTestData();
    await stopTestServer();
  });

  it('auth login matches the contract', async () => {
    const tenant = await createTenant('ctr2');
    const client = new ApiClient();
    const res = await client.login(tenant.admin.email, tenant.password);
    expect(envelope.safeParse(res.json).success).toBe(true);
    expect(userContract.safeParse((res.json?.data as { user: unknown }).user).success).toBe(true);
    expect(res.json).not.toHaveProperty('data.refreshToken');
  });

  it('public lookup matches the contract and has no email/phone keys', async () => {
    const res = await publicClient.request(`/api/v1/public/parking/sites/${siteCode}/lookup`, {
      method: 'POST',
      body: JSON.stringify({ vehicleNumber }),
    });
    const data = dataOf(res.json);
    expect(lookupContract.safeParse(data).success).toBe(true);
    expect(JSON.stringify(data)).not.toMatch(/"email"|"phone"/);
  });

  it('park session matches the public status contract', async () => {
    const parked = await lookupAndPark(publicClient, siteCode, vehicleNumber);
    const status = await publicClient.request('/api/v1/public/parking/session/status', {
      method: 'POST',
      body: JSON.stringify({ sessionToken: parked.sessionToken }),
    });
    expect(parkingStatusContract.safeParse(status.json?.data).success).toBe(true);
  });

  it('dashboard stats match the contract', async () => {
    const res = await admin.request('/api/v1/dashboard/stats');
    expect(dashboardContract.safeParse(res.json?.data).success).toBe(true);
  });

  it('rejects invalid sortBy on parking history', async () => {
    const res = await admin.request('/api/v1/parking?sortBy=passwordHash');
    expect(res.status).toBe(400);
  });

  it('caps parking history limit', async () => {
    const res = await admin.request('/api/v1/parking?limit=9999');
    expect(res.status).toBe(200);
    const meta = res.json?.meta as { limit?: number };
    expect(meta.limit).toBeLessThanOrEqual(100);
  });

  it('rejects inverted parking date range', async () => {
    const res = await admin.request('/api/v1/parking?dateFrom=2026-02-01&dateTo=2026-01-01');
    expect(res.status).toBe(400);
  });
});
