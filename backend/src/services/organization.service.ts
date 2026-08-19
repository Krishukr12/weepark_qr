import { prisma } from '../config/prisma';
import { organizationRepository, type OrganizationWithCounts, type SiteCapacitySummary } from '../repositories/organization.repository';
import { siteRepository } from '../repositories/site.repository';
import { userRepository } from '../repositories/user.repository';
import { ApiError } from '../utils/apiError';
import { hashPassword } from '../utils/password';
import { generateRandomPassword } from '../utils/token';
import { buildPaginatedResult } from '../utils/pagination';
import { emailService } from './email.service';
import { notificationService } from './notification.service';
import { recordAudit } from './audit.service';
import { revokeAllRefreshTokens } from '../utils/sessions';
import type { PaginatedResult, PaginationParams } from '../types';
import type {
  CreateOrganizationInput,
  SiteAllocationInput,
  UpdateOrganizationInput,
} from '../validators/organization.validator';
import type { Organization, OrganizationClientType } from '@prisma/client';
import { assertSiteClientTypeCompatible } from './parking-mode';

/**
 * Validates that each site allocation fits within remaining site capacity
 * after accounting for other organizations' allocations.
 */
async function validateSiteAllocations(
  allocations: SiteAllocationInput[],
  excludeOrganizationId?: string,
): Promise<void> {
  if (allocations.length === 0) return;

  const siteIds = allocations.map((a) => a.siteId);
  if (new Set(siteIds).size !== siteIds.length) {
    throw ApiError.badRequest('Duplicate sites in the allocation list');
  }

  const sites = await prisma.site.findMany({
    where: { id: { in: siteIds }, isActive: true },
    select: {
      id: true,
      name: true,
      totalCapacity: true,
      organizationAssignments: {
        select: { organizationId: true, allocatedSpaces: true },
      },
    },
  });

  if (sites.length !== siteIds.length) {
    throw ApiError.badRequest('One or more selected sites are invalid or inactive');
  }

  const siteById = new Map(sites.map((s) => [s.id, s]));

  for (const allocation of allocations) {
    const site = siteById.get(allocation.siteId);
    if (!site) throw ApiError.badRequest('One or more selected sites are invalid or inactive');

    if (allocation.allocatedSpaces > site.totalCapacity) {
      throw ApiError.badRequest(
        `${site.name} only has ${site.totalCapacity} spaces — you cannot allocate ${allocation.allocatedSpaces}`,
      );
    }

    const allocatedToOthers = site.organizationAssignments
      .filter((a) => a.organizationId !== excludeOrganizationId)
      .reduce((sum, a) => sum + a.allocatedSpaces, 0);

    const remaining = site.totalCapacity - allocatedToOthers;
    if (allocation.allocatedSpaces > remaining) {
      throw ApiError.badRequest(
        `${site.name} only has ${remaining} space${remaining === 1 ? '' : 's'} remaining ` +
          `(${allocatedToOthers} already allocated to other organizations)`,
      );
    }
  }
}

export const organizationService = {
  async list(
    params: PaginationParams & { clientType?: OrganizationClientType },
  ): Promise<PaginatedResult<OrganizationWithCounts>> {
    const { items, total } = await organizationRepository.findMany(params);
    return buildPaginatedResult(items, total, params);
  },

  async getById(id: string): Promise<OrganizationWithCounts> {
    const org = await organizationRepository.findById(id);
    if (!org) throw ApiError.notFound('Organization not found');
    return org;
  },

  listActive(): Promise<Pick<Organization, 'id' | 'name' | 'companyName'>[]> {
    return organizationRepository.listActive();
  },

  /** Public QR page — only organizations assigned to this site. */
  async listActiveForSite(siteCode: string): Promise<Pick<Organization, 'id' | 'name' | 'companyName'>[]> {
    const site = await siteRepository.findByCode(siteCode);
    if (!site || !site.isActive) throw ApiError.notFound('This parking site does not exist or is inactive');
    return organizationRepository.listActiveForSite(site.id);
  },

  getSiteIds(organizationId: string): Promise<string[]> {
    return organizationRepository.getSiteIds(organizationId);
  },

  getSiteCapacitySummaries(excludeOrganizationId?: string): Promise<SiteCapacitySummary[]> {
    return organizationRepository.getSiteCapacitySummaries(excludeOrganizationId);
  },

  async assertCanUseSite(organizationId: string, siteId: string): Promise<void> {
    const assigned = await organizationRepository.isAssignedToSite(organizationId, siteId);
    if (!assigned) {
      throw ApiError.forbidden('This organization is not assigned to this parking site');
    }
  },

  /**
   * Onboarding: creates the organization + its admin login atomically,
   * then emails the generated credentials to the admin.
   */
  async create(input: CreateOrganizationInput, actorId: string): Promise<OrganizationWithCounts> {
    const email = input.adminEmail.toLowerCase();
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) throw ApiError.conflict('A user with this admin email already exists');

    await validateSiteAllocations(input.siteAllocations);
    await assertSiteClientTypeCompatible(
      input.siteAllocations.map((a) => a.siteId),
      input.clientType,
    );

    const totalAllocated = input.siteAllocations.reduce((sum, a) => sum + a.allocatedSpaces, 0);
    const parkingAllocation = totalAllocated > 0 ? totalAllocated : input.parkingAllocation;

    const password = generateRandomPassword();
    const passwordHash = await hashPassword(password);

    const organization = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: input.name,
          companyName: input.companyName,
          gstNumber: input.gstNumber || null,
          adminName: input.adminName,
          adminEmail: email,
          adminPhone: input.adminPhone || null,
          address: input.address || null,
          logoUrl: input.logoUrl || null,
          parkingAllocation,
          clientType: input.clientType,
          isActive: input.isActive,
        },
      });

      await tx.user.create({
        data: {
          name: input.adminName,
          email,
          phone: input.adminPhone || null,
          passwordHash,
          role: 'ORG_ADMIN',
          organizationId: org.id,
        },
      });

      return org;
    });

    if (input.siteAllocations.length > 0) {
      await organizationRepository.setSites(organization.id, input.siteAllocations);
    }

    await emailService.sendOrganizationWelcome({
      to: email,
      companyName: organization.companyName,
      adminName: organization.adminName,
      email,
      password,
      clientType: organization.clientType,
    });

    await notificationService.notifyRole('SUPER_ADMIN', {
      type: 'ORGANIZATION_CREATED',
      title: 'Organization onboarded',
      message: `${organization.companyName} has been onboarded to WeePark`,
      data: { organizationId: organization.id },
    });

    await recordAudit({
      userId: actorId,
      action: 'ORGANIZATION_CREATED',
      entity: 'Organization',
      entityId: organization.id,
      metadata: { companyName: organization.companyName, siteAllocations: input.siteAllocations },
    });

    return this.getById(organization.id);
  },

  async update(id: string, input: UpdateOrganizationInput, actorId: string): Promise<OrganizationWithCounts> {
    const org = await organizationRepository.findById(id);
    if (!org) throw ApiError.notFound('Organization not found');

    if (input.siteAllocations !== undefined) {
      await validateSiteAllocations(input.siteAllocations, id);
      await assertSiteClientTypeCompatible(
        input.siteAllocations.map((a) => a.siteId),
        org.clientType,
        id,
      );
    }

    const totalAllocated =
      input.siteAllocations !== undefined
        ? input.siteAllocations.reduce((sum, a) => sum + a.allocatedSpaces, 0)
        : undefined;

    await organizationRepository.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.companyName !== undefined ? { companyName: input.companyName } : {}),
      ...(input.gstNumber !== undefined ? { gstNumber: input.gstNumber || null } : {}),
      ...(input.adminName !== undefined ? { adminName: input.adminName } : {}),
      ...(input.adminPhone !== undefined ? { adminPhone: input.adminPhone || null } : {}),
      ...(input.address !== undefined ? { address: input.address || null } : {}),
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl || null } : {}),
      ...(totalAllocated !== undefined
        ? { parkingAllocation: totalAllocated }
        : input.parkingAllocation !== undefined
          ? { parkingAllocation: input.parkingAllocation }
          : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    });

    if (input.siteAllocations !== undefined) {
      await organizationRepository.setSites(id, input.siteAllocations);
    }

    if (input.isActive !== undefined) {
      await prisma.user.updateMany({
        where: { organizationId: id, role: 'ORG_ADMIN' },
        data: { isActive: input.isActive },
      });
      if (input.isActive === false) {
        const users = await prisma.user.findMany({ where: { organizationId: id }, select: { id: true } });
        await Promise.all(users.map((user) => revokeAllRefreshTokens(user.id)));
      }
    }

    await recordAudit({ userId: actorId, action: 'ORGANIZATION_UPDATED', entity: 'Organization', entityId: id });
    return this.getById(id);
  },

  async assignSite(
    organizationId: string,
    siteId: string,
    allocatedSpaces: number,
    actorId: string,
  ): Promise<OrganizationWithCounts> {
    const [org, site] = await Promise.all([
      organizationRepository.findById(organizationId),
      siteRepository.findById(siteId),
    ]);
    if (!org) throw ApiError.notFound('Organization not found');
    if (!site || !site.isActive) throw ApiError.notFound('Site not found or inactive');

    await validateSiteAllocations([{ siteId, allocatedSpaces }], organizationId);
    await assertSiteClientTypeCompatible([siteId], org.clientType, organizationId);

    await organizationRepository.assignSite(organizationId, siteId, allocatedSpaces);

    const all = await organizationRepository.getSiteIds(organizationId);
    const assignments = await prisma.organizationSiteAssignment.findMany({
      where: { organizationId },
      select: { allocatedSpaces: true },
    });
    await organizationRepository.update(organizationId, {
      parkingAllocation: assignments.reduce((sum, a) => sum + a.allocatedSpaces, 0),
    });

    await recordAudit({
      userId: actorId,
      action: 'ORG_SITE_ASSIGNED',
      entity: 'Organization',
      entityId: organizationId,
      metadata: { siteId, siteName: site.name, allocatedSpaces, totalSites: all.length },
    });
    return this.getById(organizationId);
  },

  async unassignSite(organizationId: string, siteId: string, actorId: string): Promise<OrganizationWithCounts> {
    const org = await organizationRepository.findById(organizationId);
    if (!org) throw ApiError.notFound('Organization not found');

    const activeParkings = await prisma.parkingEntry.count({
      where: {
        organizationId,
        siteId,
        status: { in: ['PARKED', 'PICKUP_REQUESTED', 'PICKUP_IN_PROGRESS'] },
      },
    });
    if (activeParkings > 0) {
      throw ApiError.conflict('Cannot unassign a site while this organization has actively parked vehicles there');
    }

    await organizationRepository.unassignSite(organizationId, siteId);

    const assignments = await prisma.organizationSiteAssignment.findMany({
      where: { organizationId },
      select: { allocatedSpaces: true },
    });
    await organizationRepository.update(organizationId, {
      parkingAllocation: assignments.reduce((sum, a) => sum + a.allocatedSpaces, 0),
    });

    await recordAudit({
      userId: actorId,
      action: 'ORG_SITE_UNASSIGNED',
      entity: 'Organization',
      entityId: organizationId,
      metadata: { siteId },
    });
    return this.getById(organizationId);
  },

  async remove(id: string, actorId: string): Promise<void> {
    const activeParkings = await prisma.parkingEntry.count({
      where: { organizationId: id, status: { in: ['PARKED', 'PICKUP_REQUESTED', 'PICKUP_IN_PROGRESS'] } },
    });
    if (activeParkings > 0) {
      throw ApiError.conflict('Cannot delete an organization with actively parked vehicles');
    }
    await organizationRepository.delete(id);
    await recordAudit({ userId: actorId, action: 'ORGANIZATION_DELETED', entity: 'Organization', entityId: id });
  },
};
