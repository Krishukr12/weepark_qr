import { z } from 'zod';
import { cuidId, optionalUrl, strictInt } from './common';

export const createSiteSchema = z.object({
  name: z.string().min(2, 'Site name is too short').max(120),
  address: z.string().min(4, 'Address is too short').max(500),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  googleMapsLink: optionalUrl,
  totalCapacity: strictInt(1, 100000),
  isActive: z.boolean().optional().default(true),
});

export const updateSiteSchema = createSiteSchema.partial();

export const assignValetsSchema = z.object({
  valetIds: z.array(cuidId).min(1, 'Select at least one valet'),
});

export type CreateSiteInput = z.infer<typeof createSiteSchema>;
export type UpdateSiteInput = z.infer<typeof updateSiteSchema>;
