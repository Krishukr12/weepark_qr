import { z } from 'zod';

export const siteAllocationSchema = z.object({
  siteId: z.string().min(1, 'Site is required'),
  allocatedSpaces: z.coerce.number().int().min(1, 'Allocate at least 1 space').max(100000),
});

export const createOrganizationSchema = z.object({
  name: z.string().min(2, 'Organization name is too short').max(150),
  companyName: z.string().min(2, 'Company name is too short').max(150),
  gstNumber: z.string().max(20).optional().nullable().or(z.literal('')),
  adminName: z.string().min(2, 'Admin name is too short').max(100),
  adminEmail: z.string().email('Invalid admin email'),
  adminPhone: z.string().max(20).optional().nullable().or(z.literal('')),
  address: z.string().max(500).optional().nullable().or(z.literal('')),
  logoUrl: z.string().url('Invalid logo URL').optional().nullable().or(z.literal('')),
  /** Optional total requested spaces; auto-synced from site allocations when provided. */
  parkingAllocation: z.coerce.number().int().min(0).max(100000).optional().default(0),
  isActive: z.boolean().optional().default(true),
  siteAllocations: z.array(siteAllocationSchema).optional().default([]),
});

export const updateOrganizationSchema = createOrganizationSchema.partial().omit({ adminEmail: true });

export type SiteAllocationInput = z.infer<typeof siteAllocationSchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
