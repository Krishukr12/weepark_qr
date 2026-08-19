import { z } from 'zod';
import { FuelType, VehicleType } from '@prisma/client';
import { cuidId, vehicleNumberSchema } from './common';

export const createVehicleSchema = z.object({
  vehicleNumber: vehicleNumberSchema,
  vehicleType: z.nativeEnum(VehicleType).default(VehicleType.CAR),
  brand: z.string().max(60).optional().nullable().or(z.literal('')),
  model: z.string().max(60).optional().nullable().or(z.literal('')),
  color: z.string().max(40).optional().nullable().or(z.literal('')),
  fuelType: z.nativeEnum(FuelType).default(FuelType.PETROL),
  isPrimary: z.boolean().optional().default(false),
  rcNumber: z.string().max(40).optional().nullable().or(z.literal('')),
  employeeId: cuidId,
});

export const updateVehicleSchema = createVehicleSchema.partial().omit({ employeeId: true });

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
