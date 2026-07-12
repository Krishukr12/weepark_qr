import { z } from 'zod';

export const createOrganizationSchema = z.object({
  name: z.string().min(2, 'Organization name is too short').max(150),
  companyName: z.string().min(2, 'Company name is too short').max(150),
  gstNumber: z.string().max(20).optional().nullable().or(z.literal('')),
  adminName: z.string().min(2, 'Admin name is too short').max(100),
  adminEmail: z.string().email('Invalid admin email'),
  adminPhone: z.string().max(20).optional().nullable().or(z.literal('')),
  address: z.string().max(500).optional().nullable().or(z.literal('')),
  logoUrl: z.string().url('Invalid logo URL').optional().nullable().or(z.literal('')),
  parkingAllocation: z.coerce.number().int().min(0).max(100000).default(0),
  isActive: z.boolean().optional().default(true),
});

export const updateOrganizationSchema = createOrganizationSchema.partial();

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
