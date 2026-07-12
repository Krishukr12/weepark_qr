import { z } from 'zod';

export const createSiteSchema = z.object({
  name: z.string().min(2, 'Site name is too short').max(120),
  address: z.string().min(4, 'Address is too short').max(500),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  googleMapsLink: z.string().url('Invalid Google Maps link').optional().nullable().or(z.literal('')),
  totalCapacity: z.coerce.number().int().min(1, 'Capacity must be at least 1').max(100000),
  isActive: z.boolean().optional().default(true),
});

export const updateSiteSchema = createSiteSchema.partial();

export const assignValetsSchema = z.object({
  valetIds: z.array(z.string().min(1)).min(1, 'Select at least one valet'),
});

export type CreateSiteInput = z.infer<typeof createSiteSchema>;
export type UpdateSiteInput = z.infer<typeof updateSiteSchema>;
