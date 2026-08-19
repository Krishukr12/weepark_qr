import { z } from 'zod';
import { FuelType, ParkingStatus, VehicleType } from '@prisma/client';
import { cuidId, dateRangeRefine, phoneSchema, siteCodeSchema, vehicleNumberSchema } from './common';

export const lookupVehicleSchema = z.object({
  vehicleNumber: vehicleNumberSchema,
});

export const guestCheckInSchema = z.object({
  vehicleNumber: vehicleNumberSchema,
  phone: phoneSchema,
});

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
    phone: phoneSchema,
    employeeCode: z.string().min(1, 'Employee ID is required').max(50),
    organizationId: cuidId,
  }),
});

export const parkVehicleSchema = z.object({
  parkToken: z.string().min(20, 'Parking authorization is required').max(2000),
  notes: z.string().max(500).optional(),
});

export const parkingSessionSchema = z.object({
  sessionToken: z.string().min(20, 'Parking session is required').max(2000),
});

export const publicPickupSchema = z.object({
  sessionToken: z.string().min(20, 'Parking session is required').max(2000),
  vehicleNumber: vehicleNumberSchema,
  ticketCode: z.string().min(8).max(40),
});

export const siteCodeParamsSchema = z.object({
  siteCode: siteCodeSchema,
});

export const idParamsSchema = z.object({
  id: cuidId,
});

export const parkingHistoryFilterSchema = z
  .object({
    status: z.nativeEnum(ParkingStatus).optional(),
    siteId: cuidId.optional(),
    organizationId: cuidId.optional(),
    employeeId: cuidId.optional(),
    vehicleId: cuidId.optional(),
    valetId: cuidId.optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
  })
  .refine(dateRangeRefine, { message: 'dateFrom must be before dateTo', path: ['dateFrom'] });

export const PARKING_SORT_FIELDS = ['createdAt', 'updatedAt', 'parkedAt', 'status', 'ticketCode'] as const;

export type QuickRegisterInput = z.infer<typeof quickRegisterSchema>;
export type GuestCheckInInput = z.infer<typeof guestCheckInSchema>;
export type ParkingHistoryFilter = z.infer<typeof parkingHistoryFilterSchema>;
