import type { Organization, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { PaginationParams } from '../types';
import { toSkipTake } from '../utils/pagination';

const orgWithCounts = {
  include: {
    _count: { select: { employees: true, parkingEntries: true } },
  },
} satisfies Prisma.OrganizationDefaultArgs;

export type OrganizationWithCounts = Prisma.OrganizationGetPayload<typeof orgWithCounts>;

export const organizationRepository = {
  async findMany(params: PaginationParams): Promise<{ items: OrganizationWithCounts[]; total: number }> {
    const where: Prisma.OrganizationWhereInput = params.search
      ? {
          OR: [
            { name: { contains: params.search, mode: 'insensitive' } },
            { companyName: { contains: params.search, mode: 'insensitive' } },
            { adminEmail: { contains: params.search, mode: 'insensitive' } },
          ],
        }
      : {};

    const orderBy: Prisma.OrganizationOrderByWithRelationInput = params.sortBy
      ? { [params.sortBy]: params.sortOrder }
      : { createdAt: 'desc' };

    const [items, total] = await prisma.$transaction([
      prisma.organization.findMany({ where, orderBy, ...toSkipTake(params), ...orgWithCounts }),
      prisma.organization.count({ where }),
    ]);
    return { items, total };
  },

  findById(id: string): Promise<OrganizationWithCounts | null> {
    return prisma.organization.findUnique({ where: { id }, ...orgWithCounts });
  },

  findByAdminEmail(adminEmail: string): Promise<Organization | null> {
    return prisma.organization.findUnique({ where: { adminEmail: adminEmail.toLowerCase() } });
  },

  update(id: string, data: Prisma.OrganizationUpdateInput): Promise<Organization> {
    return prisma.organization.update({ where: { id }, data });
  },

  delete(id: string): Promise<Organization> {
    return prisma.organization.delete({ where: { id } });
  },

  listActive(): Promise<Pick<Organization, 'id' | 'name' | 'companyName'>[]> {
    return prisma.organization.findMany({
      where: { isActive: true },
      select: { id: true, name: true, companyName: true },
      orderBy: { name: 'asc' },
    });
  },
};
