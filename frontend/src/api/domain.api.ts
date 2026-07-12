import { deleteOne, downloadFile, getOne, getPaginated, patchOne, postOne } from './crud';
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
  PublicSite,
  Site,
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
  create: (input: Partial<Organization>): Promise<Organization> => postOne('/organizations', input),
  update: (id: string, input: Partial<Organization>): Promise<Organization> => patchOne(`/organizations/${id}`, input),
  remove: (id: string): Promise<void> => deleteOne(`/organizations/${id}`),
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
  stats: (): Promise<DashboardStats> => getOne('/dashboard/stats'),
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
  organizations: (): Promise<OrganizationOption[]> => getOne('/public/organizations'),
  lookupVehicle: (siteCode: string, vehicleNumber: string): Promise<VehicleLookupResult> =>
    postOne(`/public/parking/sites/${siteCode}/lookup`, { vehicleNumber }),
  quickRegister: (siteCode: string, input: Record<string, unknown>): Promise<Vehicle> =>
    postOne(`/public/parking/sites/${siteCode}/register`, input),
  park: (siteCode: string, vehicleId: string): Promise<ParkingEntry> =>
    postOne(`/public/parking/sites/${siteCode}/park`, { vehicleId }),
  getEntry: (id: string): Promise<ParkingEntry> => getOne(`/public/parking/entries/${id}`),
  requestPickup: (parkingEntryId: string): Promise<PickupRequest> =>
    postOne('/public/pickups/request', { parkingEntryId }),
};
