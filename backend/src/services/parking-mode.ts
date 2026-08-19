import type { OrganizationClientType } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/apiError';

export type ParkingMode = 'B2B' | 'B2C';

export interface SiteParkingContext {
  parkingMode: ParkingMode;
  b2cOrg: { id: string; name: string; companyName: string; isActive: boolean } | null;
}

/**
 * B2C only when an active B2C organization is assigned to the site.
 * Exclusivity is enforced at assignment time, so a site should never mix types.
 */
export async function getSiteParkingContext(siteId: string): Promise<SiteParkingContext> {
  const assignments = await prisma.organizationSiteAssignment.findMany({
    where: { siteId },
    include: {
      organization: {
        select: { id: true, name: true, companyName: true, isActive: true, clientType: true },
      },
    },
  });

  const activeB2C = assignments
    .map((row) => row.organization)
    .find((org) => org.isActive && org.clientType === 'B2C');

  if (activeB2C) {
    return { parkingMode: 'B2C', b2cOrg: activeB2C };
  }

  return { parkingMode: 'B2B', b2cOrg: null };
}

/**
 * A site is B2B or B2C, never mixed. At most one B2C organization per site.
 */
export async function assertSiteClientTypeCompatible(
  siteIds: string[],
  clientType: OrganizationClientType,
  excludeOrganizationId?: string,
): Promise<void> {
  if (siteIds.length === 0) return;

  const assignments = await prisma.organizationSiteAssignment.findMany({
    where: {
      siteId: { in: siteIds },
      ...(excludeOrganizationId ? { organizationId: { not: excludeOrganizationId } } : {}),
    },
    include: {
      organization: { select: { clientType: true, companyName: true } },
      site: { select: { name: true } },
    },
  });

  for (const assignment of assignments) {
    if (assignment.organization.clientType !== clientType) {
      throw ApiError.badRequest(
        assignment.organization.clientType === 'B2C'
          ? `${assignment.site.name} already has a B2C client assigned and cannot also host a B2B organization`
          : `${assignment.site.name} is B2B-only because ${assignment.organization.companyName} is already assigned`,
      );
    }
    if (clientType === 'B2C') {
      throw ApiError.badRequest(`A B2C client is already assigned to ${assignment.site.name}`);
    }
  }
}
