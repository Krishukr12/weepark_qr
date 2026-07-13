import type { Organization, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { PaginationParams } from '../types';
import { toSkipTake } from '../utils/pagination';
import type { SiteAllocationInput } from '../validators/organization.validator';

const orgWithCounts = {
  include: {
    _count: { select: { employees: true, parkingEntries: true } },
    siteAssignments: {
      select: {
        id: true,
        assignedAt: true,
        allocatedSpaces: true,
        site: { select: { id: true, name: true, siteCode: true, isActive: true, totalCapacity: true } },
      },
    },
  },
} satisfies Prisma.OrganizationDefaultArgs;

export type OrganizationWithCounts = Prisma.OrganizationGetPayload<typeof orgWithCounts>;

export interface SiteCapacitySummary {
  siteId: string;
  siteName: string;
  siteCode: string;
  totalCapacity: number;
  allocatedToOthers: number;
  remaining: number;
}

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

  /** Active organizations assigned to a specific site (for the public QR registration dropdown). */
  listActiveForSite(siteId: string): Promise<Pick<Organization, 'id' | 'name' | 'companyName'>[]> {
    return prisma.organization.findMany({
      where: { isActive: true, siteAssignments: { some: { siteId } } },
      select: { id: true, name: true, companyName: true },
      orderBy: { name: 'asc' },
    });
  },

  getSiteIds(organizationId: string): Promise<string[]> {
    return prisma.organizationSiteAssignment
      .findMany({ where: { organizationId }, select: { siteId: true } })
      .then((rows) => rows.map((r) => r.siteId));
  },

  isAssignedToSite(organizationId: string, siteId: string): Promise<boolean> {
    return prisma.organizationSiteAssignment
      .findUnique({ where: { organizationId_siteId: { organizationId, siteId } } })
      .then(Boolean);
  },

  getAllocation(organizationId: string, siteId: string): Promise<number | null> {
    return prisma.organizationSiteAssignment
      .findUnique({
        where: { organizationId_siteId: { organizationId, siteId } },
        select: { allocatedSpaces: true },
      })
      .then((row) => row?.allocatedSpaces ?? null);
  },

  /**
   * Remaining capacity available on each site for a given org.
   * Excludes this org's existing allocation so the UI can re-edit freely within leftover capacity.
   */
  async getSiteCapacitySummaries(excludeOrganizationId?: string): Promise<SiteCapacitySummary[]> {
    const sites = await prisma.site.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        siteCode: true,
        totalCapacity: true,
        organizationAssignments: {
          select: { organizationId: true, allocatedSpaces: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return sites.map((site) => {
      const allocatedToOthers = site.organizationAssignments
        .filter((a) => a.organizationId !== excludeOrganizationId)
        .reduce((sum, a) => sum + a.allocatedSpaces, 0);

      return {
        siteId: site.id,
        siteName: site.name,
        siteCode: site.siteCode,
        totalCapacity: site.totalCapacity,
        allocatedToOthers,
        remaining: Math.max(0, site.totalCapacity - allocatedToOthers),
      };
    });
  },

  async setSites(organizationId: string, allocations: SiteAllocationInput[]): Promise<void> {
    const siteIds = allocations.map((a) => a.siteId);
    await prisma.$transaction([
      prisma.organizationSiteAssignment.deleteMany({
        where: { organizationId, siteId: { notIn: siteIds } },
      }),
      ...allocations.map((allocation) =>
        prisma.organizationSiteAssignment.upsert({
          where: { organizationId_siteId: { organizationId, siteId: allocation.siteId } },
          create: {
            organizationId,
            siteId: allocation.siteId,
            allocatedSpaces: allocation.allocatedSpaces,
          },
          update: { allocatedSpaces: allocation.allocatedSpaces },
        }),
      ),
    ]);
  },

  assignSite(organizationId: string, siteId: string, allocatedSpaces: number): Promise<void> {
    return prisma.organizationSiteAssignment
      .upsert({
        where: { organizationId_siteId: { organizationId, siteId } },
        create: { organizationId, siteId, allocatedSpaces },
        update: { allocatedSpaces },
      })
      .then(() => undefined);
  },

  unassignSite(organizationId: string, siteId: string): Promise<void> {
    return prisma.organizationSiteAssignment
      .delete({ where: { organizationId_siteId: { organizationId, siteId } } })
      .then(() => undefined);
  },
};
