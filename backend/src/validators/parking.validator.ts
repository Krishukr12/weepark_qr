import { z } from 'zod';
import { FuelType, ParkingStatus, VehicleType } from '@prisma/client';

const vehicleNumberSchema = z
  .string()
  .min(4, 'Vehicle number is too short')
  .max(20)
  .transform((v) => v.toUpperCase().replace(/[\s-]/g, ''));

export const lookupVehicleSchema = z.object({
  vehicleNumber: vehicleNumberSchema,
});

/** Quick registration used from the public QR page when a vehicle is unknown. */
export const quickRegisterSchema = z.object({
  vehicleNumber: vehicleNumberSchema,
  vehicleType: z.nativeEnum(VehicleType).default(VehicleType.CAR),
  brand: z.string().max(60).optional().or(z.literal('')),
  model: z.string().max(60).optional().or(z.literal('')),
  color: z.string().max(40).optional().or(z.literal('')),
  fuelType: z.nativeEnum(FuelType).default(FuelType.PETROL),
  employee: z.object({
    name: z.string().min(2, 'Name is too short').max(100),
    email: z.string().email('Invalid email'),
    phone: z.string().min(6, 'Phone is too short').max(20),
    employeeCode: z.string().min(1, 'Employee ID is required').max(50),
    organizationId: z.string().min(1, 'Organization is required'),
  }),
});

export const parkVehicleSchema = z.object({
  vehicleId: z.string().min(1, 'Vehicle is required'),
  notes: z.string().max(500).optional(),
});

export const parkingHistoryFilterSchema = z.object({
  status: z.nativeEnum(ParkingStatus).optional(),
  siteId: z.string().optional(),
  organizationId: z.string().optional(),
  employeeId: z.string().optional(),
  vehicleId: z.string().optional(),
  valetId: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export type QuickRegisterInput = z.infer<typeof quickRegisterSchema>;
export type ParkingHistoryFilter = z.infer<typeof parkingHistoryFilterSchema>;
