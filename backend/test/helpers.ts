import http from 'node:http';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import { generateSiteCode } from '../src/utils/codes';
import { closeSocket, initSocket } from '../src/sockets/socket';

export let baseUrl = '';
let server: http.Server | null = null;
let expressApp: Express | null = null;

export function getApp(): Express {
  if (!expressApp) expressApp = createApp();
  return expressApp;
}

export function api() {
  return request(getApp());
}

export function apiAgent() {
  return request.agent(getApp());
}

export async function startTestServer(): Promise<void> {
  if (server) return;
  const app = getApp();
  server = http.createServer(app);
  initSocket(server);
  await new Promise<void>((resolve) => {
    server!.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
}

export async function stopTestServer(): Promise<void> {
  if (!server) return;
  await closeSocket();
  await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = null;
}

export class ApiClient {
  accessToken = '';
  cookies = new Map<string, string>();

  private applyCookies(headers: Record<string, string>): void {
    if (this.cookies.size === 0) return;
    headers.Cookie = [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  private storeCookies(res: Response): void {
    const setCookie = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    for (const cookie of setCookie) {
      const [pair] = cookie.split(';');
      const eq = pair.indexOf('=');
      if (eq > 0) this.cookies.set(pair.slice(0, eq), pair.slice(eq + 1));
    }
  }

  async request(
    path: string,
    init: RequestInit = {},
  ): Promise<{ status: number; json: Record<string, unknown> | null; res: Response }> {
    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string> | undefined),
    };
    if (!headers['Content-Type'] && init.body) headers['Content-Type'] = 'application/json';
    if (this.accessToken && !headers.Authorization) headers.Authorization = `Bearer ${this.accessToken}`;
    this.applyCookies(headers);
    const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
    this.storeCookies(res);
    const text = await res.text();
    let json: Record<string, unknown> | null = null;
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    } catch {
      json = null;
    }
    return { status: res.status, json, res };
  }

  async login(email: string, password: string): Promise<{ status: number; json: Record<string, unknown> | null }> {
    const result = await this.request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    const data = result.json?.data as { accessToken?: string } | undefined;
    if (data?.accessToken) this.accessToken = data.accessToken;
    return result;
  }
}

export function dataOf<T>(json: Record<string, unknown> | null): T {
  return json?.data as T;
}

let seq = 0;
export function unique(prefix: string): string {
  seq += 1;
  return `${prefix}${Date.now().toString(36)}${seq}`;
}

export async function hash(password: string): Promise<string> {
  return bcrypt.hash(password, 4);
}

export interface TenantFixture {
  password: string;
  org: { id: string; name: string };
  admin: { id: string; email: string };
  valet: { id: string; email: string };
  otherValet: { id: string; email: string };
  employee: { id: string; email: string };
  vehicle: { id: string; vehicleNumber: string };
  site: { id: string; siteCode: string };
  otherSite: { id: string; siteCode: string };
}

export async function createTenant(label: string): Promise<TenantFixture> {
  const password = 'TestPass1234';
  const passwordHash = await hash(password);
  const stamp = unique(label);

  const site = await prisma.site.create({
    data: {
      siteCode: generateSiteCode(),
      name: `Site ${stamp}`,
      address: '1 Test Street, Bengaluru',
      totalCapacity: 20,
    },
  });
  const otherSite = await prisma.site.create({
    data: {
      siteCode: generateSiteCode(),
      name: `Other site ${stamp}`,
      address: '2 Test Street, Bengaluru',
      totalCapacity: 10,
    },
  });

  const org = await prisma.organization.create({
    data: {
      name: `Org ${stamp}`,
      companyName: `Company ${stamp}`,
      adminName: 'Org Admin',
      adminEmail: `admin-${stamp}@wptest.local`,
      parkingAllocation: 10,
    },
  });

  await prisma.organizationSiteAssignment.create({
    data: { organizationId: org.id, siteId: site.id, allocatedSpaces: 10 },
  });

  const admin = await prisma.user.create({
    data: {
      name: 'Org Admin',
      email: `orgadmin-${stamp}@wptest.local`,
      passwordHash,
      role: 'ORG_ADMIN',
      organizationId: org.id,
    },
  });

  const valet = await prisma.user.create({
    data: {
      name: 'Valet',
      email: `valet-${stamp}@wptest.local`,
      passwordHash,
      role: 'VALET',
    },
  });
  await prisma.valetSiteAssignment.create({ data: { valetId: valet.id, siteId: site.id } });

  const otherValet = await prisma.user.create({
    data: {
      name: 'Other Valet',
      email: `ovalet-${stamp}@wptest.local`,
      passwordHash,
      role: 'VALET',
    },
  });
  await prisma.valetSiteAssignment.create({ data: { valetId: otherValet.id, siteId: otherSite.id } });

  const employee = await prisma.employee.create({
    data: {
      employeeCode: `EMP-${stamp}`,
      name: 'Test Employee',
      email: `emp-${stamp}@wptest.local`,
      phone: '9876543210',
      organizationId: org.id,
    },
  });

  const vehicleNumber = `WPT${stamp.replace(/[^A-Z0-9]/gi, '').slice(-8)}`.slice(0, 12).toUpperCase();
  const vehicle = await prisma.vehicle.create({
    data: {
      vehicleNumber,
      vehicleType: 'CAR',
      employeeId: employee.id,
    },
  });

  return {
    password,
    org: { id: org.id, name: org.name },
    admin: { id: admin.id, email: admin.email },
    valet: { id: valet.id, email: valet.email },
    otherValet: { id: otherValet.id, email: otherValet.email },
    employee: { id: employee.id, email: employee.email },
    vehicle: { id: vehicle.id, vehicleNumber: vehicle.vehicleNumber },
    site: { id: site.id, siteCode: site.siteCode },
    otherSite: { id: otherSite.id, siteCode: otherSite.siteCode },
  };
}

export interface B2cTenantFixture {
  password: string;
  org: { id: string; name: string };
  admin: { id: string; email: string };
  valet: { id: string; email: string };
  site: { id: string; siteCode: string };
}

export async function createB2cTenant(label: string, allocatedSpaces = 10): Promise<B2cTenantFixture> {
  const password = 'TestPass1234';
  const passwordHash = await hash(password);
  const stamp = unique(label);

  const site = await prisma.site.create({
    data: {
      siteCode: generateSiteCode(),
      name: `Site ${stamp}`,
      address: '9 Walk-in Street, Bengaluru',
      totalCapacity: 20,
    },
  });

  const org = await prisma.organization.create({
    data: {
      name: `B2C Org ${stamp}`,
      companyName: `Walk-in ${stamp}`,
      adminName: 'B2C Admin',
      adminEmail: `b2c-admin-${stamp}@wptest.local`,
      parkingAllocation: allocatedSpaces,
      clientType: 'B2C',
    },
  });

  await prisma.organizationSiteAssignment.create({
    data: { organizationId: org.id, siteId: site.id, allocatedSpaces },
  });

  const admin = await prisma.user.create({
    data: {
      name: 'B2C Admin',
      email: `b2c-orgadmin-${stamp}@wptest.local`,
      passwordHash,
      role: 'ORG_ADMIN',
      organizationId: org.id,
    },
  });

  const valet = await prisma.user.create({
    data: {
      name: 'B2C Valet',
      email: `b2c-valet-${stamp}@wptest.local`,
      passwordHash,
      role: 'VALET',
    },
  });
  await prisma.valetSiteAssignment.create({ data: { valetId: valet.id, siteId: site.id } });

  return {
    password,
    org: { id: org.id, name: org.name },
    admin: { id: admin.id, email: admin.email },
    valet: { id: valet.id, email: valet.email },
    site: { id: site.id, siteCode: site.siteCode },
  };
}

export async function createSuperAdmin(): Promise<{ email: string; password: string; id: string }> {
  const password = 'TestPass1234';
  const stamp = unique('sa');
  const user = await prisma.user.create({
    data: {
      name: 'Super Admin Test',
      email: `super-${stamp}@wptest.local`,
      passwordHash: await hash(password),
      role: 'SUPER_ADMIN',
    },
  });
  return { email: user.email, password, id: user.id };
}

export async function lookupAndPark(
  client: ApiClient,
  siteCode: string,
  vehicleNumber: string,
): Promise<{ sessionToken: string; parking: { ticketCode: string; vehicleNumber: string; status: string } }> {
  const lookup = await client.request(`/api/v1/public/parking/sites/${siteCode}/lookup`, {
    method: 'POST',
    body: JSON.stringify({ vehicleNumber }),
  });
  const looked = dataOf<{
    parkToken?: string;
    sessionToken?: string;
    alreadyParked?: boolean;
    parking?: { ticketCode: string; vehicleNumber: string; status: string };
  }>(lookup.json);
  if (looked.sessionToken && looked.parking) {
    return { sessionToken: looked.sessionToken, parking: looked.parking };
  }
  if (!looked.parkToken) {
    throw new Error(`No parkToken for ${vehicleNumber} at ${siteCode}: ${JSON.stringify(lookup.json)}`);
  }
  const parked = await client.request(`/api/v1/public/parking/sites/${siteCode}/park`, {
    method: 'POST',
    body: JSON.stringify({ parkToken: looked.parkToken }),
  });
  if (parked.status !== 201) {
    throw new Error(`Park failed (${parked.status}): ${JSON.stringify(parked.json)}`);
  }
  return dataOf(parked.json);
}

export async function requestPickup(
  client: ApiClient,
  sessionToken: string,
  vehicleNumber: string,
  ticketCode: string,
): Promise<{ status: number; json: Record<string, unknown> | null }> {
  return client.request('/api/v1/public/pickups/request', {
    method: 'POST',
    body: JSON.stringify({ sessionToken, vehicleNumber, ticketCode }),
  });
}

export function errorEnvelope(json: Record<string, unknown> | null): { code?: string; message?: string } {
  const error = json?.error as { code?: string; message?: string } | undefined;
  return error ?? {};
}

export async function cleanupTestData(): Promise<void> {
  await prisma.pickupRequest.deleteMany({
    where: { parkingEntry: { vehicle: { vehicleNumber: { startsWith: 'WPT' } } } },
  });
  await prisma.parkingEntry.deleteMany({
    where: { vehicle: { vehicleNumber: { startsWith: 'WPT' } } },
  });
  await prisma.vehicle.deleteMany({ where: { vehicleNumber: { startsWith: 'WPT' } } });
  await prisma.employee.deleteMany({ where: { isGuest: true, email: { endsWith: '@internal.weepark' } } });
  await prisma.employee.deleteMany({ where: { email: { endsWith: '@wptest.local' } } });
  await prisma.refreshToken.deleteMany({ where: { user: { email: { endsWith: '@wptest.local' } } } });
  await prisma.passwordResetToken.deleteMany({ where: { user: { email: { endsWith: '@wptest.local' } } } });
  await prisma.notification.deleteMany({ where: { user: { email: { endsWith: '@wptest.local' } } } });
  await prisma.auditLog.deleteMany({ where: { user: { email: { endsWith: '@wptest.local' } } } });
  await prisma.valetSiteAssignment.deleteMany({
    where: { valet: { email: { endsWith: '@wptest.local' } } },
  });
  await prisma.organizationSiteAssignment.deleteMany({
    where: { organization: { adminEmail: { endsWith: '@wptest.local' } } },
  });
  await prisma.user.deleteMany({ where: { email: { endsWith: '@wptest.local' } } });
  await prisma.organization.deleteMany({ where: { adminEmail: { endsWith: '@wptest.local' } } });
  await prisma.site.deleteMany({ where: { name: { startsWith: 'Site ' } } });
  await prisma.site.deleteMany({ where: { name: { startsWith: 'Other site ' } } });
}
