import { z } from 'zod';

export const createValetSchema = z.object({
  name: z.string().min(2, 'Name is too short').max(100),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(6, 'Phone is too short').max(20),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a number')
    .optional(),
  photoUrl: z.string().url('Invalid URL').optional().nullable().or(z.literal('')),
  isActive: z.boolean().optional().default(true),
  siteIds: z.array(z.string()).optional().default([]),
});

export const updateValetSchema = createValetSchema.partial().omit({ password: true });

export type CreateValetInput = z.infer<typeof createValetSchema>;
export type UpdateValetInput = z.infer<typeof updateValetSchema>;
