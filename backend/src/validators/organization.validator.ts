import { z } from 'zod';
import { cuidId, optionalPhoneSchema, optionalUrl, strictInt } from './common';

export const siteAllocationSchema = z.object({
  siteId: cuidId,
  allocatedSpaces: strictInt(1, 100000),
});

export const createOrganizationSchema = z.object({
  name: z.string().min(2, 'Organization name is too short').max(150),
  companyName: z.string().min(2, 'Company name is too short').max(150),
  gstNumber: z.string().max(20).optional().nullable().or(z.literal('')),
  adminName: z.string().min(2, 'Admin name is too short').max(100),
  adminEmail: z.string().email('Invalid admin email'),
  adminPhone: optionalPhoneSchema,
  address: z.string().max(500).optional().nullable().or(z.literal('')),
  logoUrl: optionalUrl,
  parkingAllocation: strictInt(0, 100000).optional().default(0),
  isActive: z.boolean().optional().default(true),
  siteAllocations: z.array(siteAllocationSchema).optional().default([]),
});

export const updateOrganizationSchema = createOrganizationSchema.partial().omit({ adminEmail: true });

export const assignOrgSiteSchema = z.object({
  allocatedSpaces: strictInt(1, 100000),
});

export const publicOrganizationsQuerySchema = z.object({
  siteCode: z
    .string()
    .regex(/^WP-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/, 'Invalid site code'),
});

export type SiteAllocationInput = z.infer<typeof siteAllocationSchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
