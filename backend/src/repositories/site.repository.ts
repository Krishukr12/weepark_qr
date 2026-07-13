import type { Prisma, Site } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { PaginationParams } from '../types';
import { toSkipTake } from '../utils/pagination';

const siteWithCounts = {
  include: {
    _count: { select: { valetAssignments: true } },
  },
} satisfies Prisma.SiteDefaultArgs;

export type SiteWithCounts = Prisma.SiteGetPayload<typeof siteWithCounts>;

export const siteRepository = {
  async findMany(params: PaginationParams & { isActive?: boolean; siteIds?: string[] }): Promise<{ items: SiteWithCounts[]; total: number }> {
    const where: Prisma.SiteWhereInput = {
      ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
      ...(params.siteIds ? { id: { in: params.siteIds } } : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { siteCode: { contains: params.search, mode: 'insensitive' } },
              { address: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.SiteOrderByWithRelationInput = params.sortBy
      ? { [params.sortBy]: params.sortOrder }
      : { createdAt: 'desc' };

    const [items, total] = await prisma.$transaction([
      prisma.site.findMany({ where, orderBy, ...toSkipTake(params), ...siteWithCounts }),
      prisma.site.count({ where }),
    ]);
    return { items, total };
  },

  findById(id: string): Promise<Site | null> {
    return prisma.site.findUnique({ where: { id } });
  },

  findByCode(siteCode: string): Promise<Site | null> {
    return prisma.site.findUnique({ where: { siteCode } });
  },

  create(data: Prisma.SiteCreateInput): Promise<Site> {
    return prisma.site.create({ data });
  },

  update(id: string, data: Prisma.SiteUpdateInput): Promise<Site> {
    return prisma.site.update({ where: { id }, data });
  },

  delete(id: string): Promise<Site> {
    return prisma.site.delete({ where: { id } });
  },

  countOccupied(siteId: string): Promise<number> {
    return prisma.parkingEntry.count({
      where: { siteId, status: { in: ['PARKED', 'PICKUP_REQUESTED', 'PICKUP_IN_PROGRESS'] } },
    });
  },
};
