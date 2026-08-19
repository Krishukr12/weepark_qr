import { deleteOne, downloadFile, getOne, getPaginated, patchOne, postOne } from './crud';
import {
  dashboardStatsSchema,
  parseResponse,
  parkResultSchema,
  publicParkingStatusSchema,
  registerResultSchema,
  vehicleLookupSchema,
} from '@/lib/response-schemas';
import type {
  AppNotification,
  AuditLog,
  DashboardStats,
  Employee,
  ListParams,
  Organization,
  OrganizationOption,
  Paginated,
  ParkingEntry,
  PeakHourPoint,
  PickupRequest,
  PublicParkingStatus,
  PublicSite,
  PublicVehicleDisplay,
  Site,
  SiteAllocationInput,
  SiteCapacitySummary,
  SiteDetail,
  TrendPoint,
  UsagePoint,
  Valet,
  Vehicle,
  VehicleLookupResult,
} from '@/types';

export const sitesApi = {
  list: (params?: ListParams): Promise<Paginated<Site>> => getPaginated('/sites', params),
  get: (id: string): Promise<SiteDetail> => getOne(`/sites/${id}`),
  create: (input: Partial<Site>): Promise<SiteDetail> => postOne('/sites', input),
  update: (id: string, input: Partial<Site>): Promise<Site> => patchOne(`/sites/${id}`, input),
  remove: (id: string): Promise<void> => deleteOne(`/sites/${id}`),
  downloadQr: (id: string): Promise<Blob> => downloadFile(`/sites/${id}/qr`),
};

export interface ValetInput {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  photoUrl?: string | null;
  isActive?: boolean;
  siteIds?: string[];
}

export const valetsApi = {
  list: (params?: ListParams): Promise<Paginated<Valet>> => getPaginated('/valets', params),
  get: (id: string): Promise<Valet> => getOne(`/valets/${id}`),
  create: (input: ValetInput): Promise<Valet> => postOne('/valets', input),
  update: (id: string, input: ValetInput): Promise<Valet> => patchOne(`/valets/${id}`, input),
  deactivate: (id: string): Promise<void> => deleteOne(`/valets/${id}`),
  assignSite: (id: string, siteId: string): Promise<void> => postOne(`/valets/${id}/sites/${siteId}`),
  unassignSite: (id: string, siteId: string): Promise<void> => deleteOne(`/valets/${id}/sites/${siteId}`),
  mySites: (): Promise<{ id: string; name: string; siteCode: string; isActive: boolean }[]> => getOne('/valets/my-sites'),
};

export const organizationsApi = {
  list: (params?: ListParams): Promise<Paginated<Organization>> => getPaginated('/organizations', params),
  get: (id: string): Promise<Organization> => getOne(`/organizations/${id}`),
  mine: (): Promise<Organization> => getOne('/organizations/mine'),
  create: (input: Partial<Organization> & { siteAllocations?: SiteAllocationInput[] }): Promise<Organization> =>
    postOne('/organizations', input),
  update: (id: string, input: Partial<Organization> & { siteAllocations?: SiteAllocationInput[] }): Promise<Organization> =>
    patchOne(`/organizations/${id}`, input),
  remove: (id: string): Promise<void> => deleteOne(`/organizations/${id}`),
  siteCapacity: (excludeOrganizationId?: string): Promise<SiteCapacitySummary[]> =>
    getOne(
      `/organizations/site-capacity${excludeOrganizationId ? `?excludeOrganizationId=${encodeURIComponent(excludeOrganizationId)}` : ''}`,
    ),
  assignSite: (id: string, siteId: string, allocatedSpaces: number): Promise<Organization> =>
    postOne(`/organizations/${id}/sites/${siteId}`, { allocatedSpaces }),
  unassignSite: (id: string, siteId: string): Promise<void> => deleteOne(`/organizations/${id}/sites/${siteId}`),
};

export const employeesApi = {
  list: (params?: ListParams): Promise<Paginated<Employee>> => getPaginated('/employees', params),
  get: (id: string): Promise<Employee> => getOne(`/employees/${id}`),
  create: (input: Partial<Employee>): Promise<Employee> => postOne('/employees', input),
  update: (id: string, input: Partial<Employee>): Promise<Employee> => patchOne(`/employees/${id}`, input),
  remove: (id: string): Promise<void> => deleteOne(`/employees/${id}`),
};

export interface VehicleInput {
  vehicleNumber?: string;
  vehicleType?: string;
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  fuelType?: string;
  isPrimary?: boolean;
  rcNumber?: string | null;
  employeeId?: string;
}

export const vehiclesApi = {
  list: (params?: ListParams): Promise<Paginated<Vehicle>> => getPaginated('/vehicles', params),
  get: (id: string): Promise<Vehicle> => getOne(`/vehicles/${id}`),
  create: (input: VehicleInput): Promise<Vehicle> => postOne('/vehicles', input),
  update: (id: string, input: VehicleInput): Promise<Vehicle> => patchOne(`/vehicles/${id}`, input),
  remove: (id: string): Promise<void> => deleteOne(`/vehicles/${id}`),
};

export const parkingApi = {
  history: (params?: ListParams): Promise<Paginated<ParkingEntry>> => getPaginated('/parking', params),
  get: (id: string): Promise<ParkingEntry> => getOne(`/parking/${id}`),
  exportCsv: (params?: ListParams): Promise<Blob> => downloadFile('/parking/export/csv', params),
  exportExcel: (params?: ListParams): Promise<Blob> => downloadFile('/parking/export/excel', params),
};

export const pickupsApi = {
  list: (params?: ListParams): Promise<Paginated<PickupRequest>> => getPaginated('/pickups', params),
  accept: (id: string): Promise<PickupRequest> => postOne(`/pickups/${id}/accept`),
  complete: (id: string): Promise<PickupRequest> => postOne(`/pickups/${id}/complete`),
};

export const notificationsApi = {
  list: (params?: ListParams): Promise<Paginated<AppNotification>> => getPaginated('/notifications', params),
  unreadCount: (): Promise<{ count: number }> => getOne('/notifications/unread-count'),
  markRead: (id: string): Promise<void> => postOne(`/notifications/${id}/read`),
  markAllRead: (): Promise<void> => postOne('/notifications/read-all'),
};

export const dashboardApi = {
  stats: async (): Promise<DashboardStats> =>
    parseResponse(dashboardStatsSchema, await getOne('/dashboard/stats'), 'dashboard'),
  parkingTrend: (days = 14): Promise<TrendPoint[]> => getOne(`/dashboard/parking-trend?days=${days}`),
  peakHours: (): Promise<PeakHourPoint[]> => getOne('/dashboard/peak-hours'),
  organizationUsage: (): Promise<UsagePoint[]> => getOne('/dashboard/organization-usage'),
  siteUsage: (): Promise<UsagePoint[]> => getOne('/dashboard/site-usage'),
};

export const auditApi = {
  list: (params?: ListParams): Promise<Paginated<AuditLog>> => getPaginated('/audit-logs', params),
};

/** Public (unauthenticated) QR flow endpoints. */
export const publicApi = {
  getSite: (siteCode: string): Promise<PublicSite> => getOne(`/public/parking/sites/${siteCode}`),
  organizations: (siteCode: string): Promise<OrganizationOption[]> =>
    getOne(`/public/organizations?siteCode=${encodeURIComponent(siteCode)}`),
  lookupVehicle: async (siteCode: string, vehicleNumber: string): Promise<VehicleLookupResult> =>
    parseResponse(
      vehicleLookupSchema,
      await postOne(`/public/parking/sites/${siteCode}/lookup`, { vehicleNumber }),
      'vehicle lookup',
    ) as VehicleLookupResult,
  guestCheckIn: async (siteCode: string, vehicleNumber: string, phone: string): Promise<VehicleLookupResult> =>
    parseResponse(
      vehicleLookupSchema,
      await postOne(`/public/parking/sites/${siteCode}/guest`, { vehicleNumber, phone }),
      'guest check-in',
    ) as VehicleLookupResult,
  quickRegister: async (
    siteCode: string,
    input: Record<string, unknown>,
  ): Promise<{ parkToken: string; display: PublicVehicleDisplay; site: { name: string; siteCode: string } }> =>
    parseResponse(
      registerResultSchema,
      await postOne(`/public/parking/sites/${siteCode}/register`, input),
      'quick register',
    ) as { parkToken: string; display: PublicVehicleDisplay; site: { name: string; siteCode: string } },
  park: async (siteCode: string, parkToken: string): Promise<{ sessionToken: string; parking: PublicParkingStatus }> =>
    parseResponse(
      parkResultSchema,
      await postOne(`/public/parking/sites/${siteCode}/park`, { parkToken }),
      'park',
    ) as { sessionToken: string; parking: PublicParkingStatus },
  getSession: async (sessionToken: string): Promise<PublicParkingStatus> =>
    parseResponse(
      publicParkingStatusSchema,
      await postOne('/public/parking/session/status', { sessionToken }),
      'parking session',
    ) as PublicParkingStatus,
  requestPickup: (sessionToken: string, vehicleNumber: string, ticketCode: string): Promise<{ status: string }> =>
    postOne('/public/pickups/request', { sessionToken, vehicleNumber, ticketCode }),
};
