import { z } from 'zod';
import { cuidId, optionalUrl, phoneSchema } from './common';

export const createValetSchema = z.object({
  name: z.string().min(2, 'Name is too short').max(100),
  email: z.string().email('Invalid email address'),
  phone: phoneSchema,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a number')
    .optional(),
  photoUrl: optionalUrl,
  isActive: z.boolean().optional().default(true),
  siteIds: z.array(cuidId).optional().default([]),
});

export const updateValetSchema = createValetSchema.partial().omit({ password: true });

export type CreateValetInput = z.infer<typeof createValetSchema>;
export type UpdateValetInput = z.infer<typeof updateValetSchema>;
