import { z } from 'zod';

const roleSchema = z.enum(['SUPER_ADMIN', 'ORG_ADMIN', 'VALET', 'EMPLOYEE']);
const parkingStatusSchema = z.enum([
  'PARKED',
  'PICKUP_REQUESTED',
  'PICKUP_IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]);

export const userSchema = z.object({
  id: z.string().min(8),
  name: z.string(),
  email: z.string().email(),
  phone: z.string().nullable().optional(),
  role: roleSchema,
  photoUrl: z.string().nullable().optional(),
  organizationId: z.string().nullable(),
  organizationClientType: z.enum(['B2B', 'B2C']).nullable().optional(),
  isActive: z.boolean(),
  createdAt: z.string().optional(),
}).passthrough();

export const authResponseSchema = z.object({
  user: userSchema,
  accessToken: z.string().min(20),
});

export const publicVehicleDisplaySchema = z.object({
  vehicleNumber: z.string(),
  vehicleType: z.string(),
  brand: z.string().nullable().optional().default(null),
  model: z.string().nullable().optional().default(null),
  color: z.string().nullable().optional().default(null),
  employeeName: z.string(),
  employeeCode: z.string(),
  organizationName: z.string(),
});

export const publicParkingStatusSchema = z.object({
  ticketCode: z.string(),
  status: parkingStatusSchema,
  parkedAt: z.string(),
  pickedUpAt: z.string().nullable().optional().default(null),
  durationMinutes: z.number().nullable().optional().default(null),
  vehicleNumber: z.string(),
  vehicleType: z.string(),
  brand: z.string().nullable().optional().default(null),
  model: z.string().nullable().optional().default(null),
  color: z.string().nullable().optional().default(null),
  employeeName: z.string(),
  organizationName: z.string(),
  siteName: z.string(),
  siteCode: z.string(),
  valetName: z.string().nullable().optional().default(null),
  pickupStatus: z.string().nullable().optional().default(null),
  pickupAcceptedByName: z.string().nullable().optional().default(null),
});

export const vehicleLookupSchema = z.object({
  found: z.boolean(),
  canParkAtSite: z.boolean(),
  alreadyParked: z.boolean(),
  vehicleNumber: z.string(),
  parkToken: z.string().optional(),
  sessionToken: z.string().optional(),
  display: publicVehicleDisplaySchema.optional(),
  parking: publicParkingStatusSchema.optional(),
  site: z.object({
    name: z.string(),
    siteCode: z.string(),
  }),
});

export const parkResultSchema = z.object({
  sessionToken: z.string().min(20),
  parking: publicParkingStatusSchema,
});

export const registerResultSchema = z.object({
  parkToken: z.string().min(20),
  display: publicVehicleDisplaySchema,
  site: z.object({ name: z.string(), siteCode: z.string() }),
});

export const dashboardStatsSchema = z.object({
  todaysParking: z.number(),
  currentParked: z.number(),
  todaysPickups: z.number(),
  pendingPickups: z.number(),
  availableSpaces: z.number(),
  occupiedSpaces: z.number(),
  totalCapacity: z.number(),
  organizations: z.number(),
  employees: z.number(),
  vehicles: z.number(),
  sites: z.number(),
  valets: z.number(),
});

export function parseResponse<T>(schema: z.ZodType<T>, data: unknown, label: string): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Unexpected ${label} response from server`);
  }
  return parsed.data;
}
