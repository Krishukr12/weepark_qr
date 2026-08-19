import { z } from 'zod';
import { cuidId, optionalPhoneSchema } from './common';

export const createEmployeeSchema = z.object({
  employeeCode: z.string().min(1, 'Employee ID is required').max(50),
  name: z.string().min(2, 'Name is too short').max(100),
  department: z.string().max(100).optional().nullable().or(z.literal('')),
  designation: z.string().max(100).optional().nullable().or(z.literal('')),
  phone: optionalPhoneSchema,
  email: z.string().email('Invalid email address'),
  isActive: z.boolean().optional().default(true),
  organizationId: cuidId.optional(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial().omit({ organizationId: true });

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
