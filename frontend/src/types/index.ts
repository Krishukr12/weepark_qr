export type Role = 'SUPER_ADMIN' | 'ORG_ADMIN' | 'VALET' | 'EMPLOYEE';

export type VehicleType = 'CAR' | 'SUV' | 'BIKE' | 'SCOOTER' | 'EV' | 'OTHER';
export type FuelType = 'PETROL' | 'DIESEL' | 'ELECTRIC' | 'HYBRID' | 'CNG' | 'OTHER';
export type ParkingStatus = 'PARKED' | 'PICKUP_REQUESTED' | 'PICKUP_IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type PickupStatus = 'PENDING' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED';
export type NotificationType =
  | 'VEHICLE_PARKED'
  | 'PICKUP_REQUESTED'
  | 'PICKUP_ACCEPTED'
  | 'PICKUP_COMPLETED'
  | 'ORGANIZATION_CREATED'
  | 'VALET_ASSIGNED'
  | 'VALET_UNASSIGNED'
  | 'SYSTEM';

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  photoUrl: string | null;
  organizationId: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface SiteOccupancy {
  totalCapacity: number;
  occupied: number;
  available: number;
  occupancyRate: number;
}

export interface OrgSiteAllocation {
  allocatedSpaces: number;
  occupied: number;
  available: number;
  occupancyRate: number;
}

export interface Site {
  id: string;
  siteCode: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  googleMapsLink: string | null;
  totalCapacity: number;
  isActive: boolean;
  createdAt: string;
  occupancy?: SiteOccupancy;
  orgAllocation?: OrgSiteAllocation | null;
  _count?: { valetAssignments: number };
}

export interface SiteDetail extends Site {
  occupancy: SiteOccupancy;
  qrDataUrl: string;
  parkingUrl: string;
  valets: ValetSummary[];
}

export interface ValetSummary {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  photoUrl: string | null;
  isActive: boolean;
  assignedAt?: string;
}

export interface Valet {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  photoUrl: string | null;
  isActive: boolean;
  createdAt: string;
  valetAssignments: {
    id: string;
    assignedAt: string;
    site: { id: string; name: string; siteCode: string; isActive: boolean };
  }[];
}

export interface Organization {
  id: string;
  name: string;
  companyName: string;
  gstNumber: string | null;
  adminName: string;
  adminEmail: string;
  adminPhone: string | null;
  address: string | null;
  logoUrl: string | null;
  parkingAllocation: number;
  isActive: boolean;
  createdAt: string;
  _count?: { employees: number; parkingEntries: number };
  siteAssignments?: {
    id: string;
    assignedAt: string;
    allocatedSpaces: number;
    site: { id: string; name: string; siteCode: string; isActive: boolean; totalCapacity: number };
  }[];
}

export interface SiteCapacitySummary {
  siteId: string;
  siteName: string;
  siteCode: string;
  totalCapacity: number;
  allocatedToOthers: number;
  remaining: number;
}

export interface SiteAllocationInput {
  siteId: string;
  allocatedSpaces: number;
}

export interface OrganizationOption {
  id: string;
  name: string;
  companyName: string;
}

export interface Employee {
  id: string;
  employeeCode: string;
  name: string;
  department: string | null;
  designation: string | null;
  phone: string | null;
  email: string;
  isActive: boolean;
  organizationId: string;
  createdAt: string;
  organization?: { id: string; name: string; companyName: string };
  _count?: { vehicles: number; parkingEntries: number };
}

export interface Vehicle {
  id: string;
  vehicleNumber: string;
  vehicleType: VehicleType;
  brand: string | null;
  model: string | null;
  color: string | null;
  fuelType: FuelType;
  isPrimary: boolean;
  rcNumber: string | null;
  isActive: boolean;
  createdAt: string;
  employee: {
    id: string;
    name: string;
    employeeCode: string;
    email: string;
    phone: string | null;
    organization: { id: string; name: string; companyName: string };
  };
}

export interface ParkingEntry {
  id: string;
  ticketCode: string;
  status: ParkingStatus;
  parkedAt: string;
  pickedUpAt: string | null;
  durationMinutes: number | null;
  notes: string | null;
  vehicle: { id: string; vehicleNumber: string; vehicleType: VehicleType; brand: string | null; model: string | null; color: string | null };
  employee: { id: string; name: string; employeeCode: string; phone: string | null; email: string };
  organization: { id: string; name: string; companyName: string };
  site: { id: string; name: string; siteCode: string; address: string };
  valet: { id: string; name: string; phone: string | null } | null;
  pickupRequest: {
    id: string;
    status: PickupStatus;
    requestedAt: string;
    acceptedAt: string | null;
    completedAt: string | null;
    acceptedBy: { id: string; name: string } | null;
  } | null;
}

export interface PickupRequest {
  id: string;
  status: PickupStatus;
  requestedAt: string;
  acceptedAt: string | null;
  completedAt: string | null;
  acceptedBy: { id: string; name: string; phone: string | null } | null;
  parkingEntry: {
    id: string;
    ticketCode: string;
    status: ParkingStatus;
    parkedAt: string;
    vehicle: { id: string; vehicleNumber: string; vehicleType: VehicleType; brand: string | null; model: string | null; color: string | null };
    employee: { id: string; name: string; employeeCode: string; phone: string | null };
    organization: { id: string; name: string };
    site: { id: string; name: string; siteCode: string };
  };
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string; role: Role } | null;
}

export interface DashboardStats {
  todaysParking: number;
  currentParked: number;
  todaysPickups: number;
  pendingPickups: number;
  availableSpaces: number;
  occupiedSpaces: number;
  totalCapacity: number;
  organizations: number;
  employees: number;
  vehicles: number;
  sites: number;
  valets: number;
}

export interface TrendPoint {
  date: string;
  parkings: number;
  pickups: number;
}

export interface PeakHourPoint {
  hour: string;
  count: number;
}

export interface UsagePoint {
  name: string;
  count: number;
}

export interface PublicSite {
  id: string;
  siteCode: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  googleMapsLink: string | null;
  occupancy: SiteOccupancy;
}

export interface VehicleLookupResult {
  found: boolean;
  vehicle: Vehicle | null;
  activeParking: ParkingEntry | null;
  canParkAtSite: boolean;
  site: { id: string; name: string; siteCode: string };
}

export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  [key: string]: string | number | boolean | undefined;
}
