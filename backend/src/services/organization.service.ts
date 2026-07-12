import { prisma } from '../config/prisma';
import { organizationRepository, type OrganizationWithCounts } from '../repositories/organization.repository';
import { userRepository } from '../repositories/user.repository';
import { ApiError } from '../utils/apiError';
import { hashPassword } from '../utils/password';
import { generateRandomPassword } from '../utils/token';
import { buildPaginatedResult } from '../utils/pagination';
import { emailService } from './email.service';
import { notificationService } from './notification.service';
import { recordAudit } from './audit.service';
import type { PaginatedResult, PaginationParams } from '../types';
import type { CreateOrganizationInput, UpdateOrganizationInput } from '../validators/organization.validator';
import type { Organization } from '@prisma/client';

export const organizationService = {
  async list(params: PaginationParams): Promise<PaginatedResult<OrganizationWithCounts>> {
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

  /**
   * Onboarding: creates the organization + its admin login atomically,
   * then emails the generated credentials to the admin.
   */
  async create(input: CreateOrganizationInput, actorId: string): Promise<OrganizationWithCounts> {
    const email = input.adminEmail.toLowerCase();
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) throw ApiError.conflict('A user with this admin email already exists');

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
          parkingAllocation: input.parkingAllocation,
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

    await emailService.sendOrganizationWelcome({
      to: email,
      companyName: organization.companyName,
      adminName: organization.adminName,
      email,
      password,
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
      metadata: { companyName: organization.companyName },
    });

    return this.getById(organization.id);
  },

  async update(id: string, input: UpdateOrganizationInput, actorId: string): Promise<OrganizationWithCounts> {
    const org = await organizationRepository.findById(id);
    if (!org) throw ApiError.notFound('Organization not found');

    await organizationRepository.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.companyName !== undefined ? { companyName: input.companyName } : {}),
      ...(input.gstNumber !== undefined ? { gstNumber: input.gstNumber || null } : {}),
      ...(input.adminName !== undefined ? { adminName: input.adminName } : {}),
      ...(input.adminPhone !== undefined ? { adminPhone: input.adminPhone || null } : {}),
      ...(input.address !== undefined ? { address: input.address || null } : {}),
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl || null } : {}),
      ...(input.parkingAllocation !== undefined ? { parkingAllocation: input.parkingAllocation } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    });

    // Keep org admin logins in sync with the org's active flag.
    if (input.isActive !== undefined) {
      await prisma.user.updateMany({
        where: { organizationId: id, role: 'ORG_ADMIN' },
        data: { isActive: input.isActive },
      });
    }

    await recordAudit({ userId: actorId, action: 'ORGANIZATION_UPDATED', entity: 'Organization', entityId: id });
    return this.getById(id);
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
