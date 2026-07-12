import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { PaginationParams } from '../types';
import { toSkipTake } from '../utils/pagination';

const valetSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  photoUrl: true,
  isActive: true,
  createdAt: true,
  valetAssignments: {
    select: {
      id: true,
      assignedAt: true,
      site: { select: { id: true, name: true, siteCode: true, isActive: true } },
    },
  },
} satisfies Prisma.UserSelect;

export type ValetWithSites = Prisma.UserGetPayload<{ select: typeof valetSelect }>;

export const valetRepository = {
  async findMany(params: PaginationParams & { siteId?: string }): Promise<{ items: ValetWithSites[]; total: number }> {
    const where: Prisma.UserWhereInput = {
      role: 'VALET',
      ...(params.siteId ? { valetAssignments: { some: { siteId: params.siteId } } } : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { email: { contains: params.search, mode: 'insensitive' } },
              { phone: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.UserOrderByWithRelationInput = params.sortBy
      ? { [params.sortBy]: params.sortOrder }
      : { createdAt: 'desc' };

    const [items, total] = await prisma.$transaction([
      prisma.user.findMany({ where, orderBy, ...toSkipTake(params), select: valetSelect }),
      prisma.user.count({ where }),
    ]);
    return { items, total };
  },

  findById(id: string): Promise<ValetWithSites | null> {
    return prisma.user.findFirst({ where: { id, role: 'VALET' }, select: valetSelect });
  },

  async setSites(valetId: string, siteIds: string[]): Promise<void> {
    await prisma.$transaction([
      prisma.valetSiteAssignment.deleteMany({ where: { valetId, siteId: { notIn: siteIds } } }),
      ...siteIds.map((siteId) =>
        prisma.valetSiteAssignment.upsert({
          where: { valetId_siteId: { valetId, siteId } },
          create: { valetId, siteId },
          update: {},
        }),
      ),
    ]);
  },

  async addSite(valetId: string, siteId: string): Promise<void> {
    await prisma.valetSiteAssignment.upsert({
      where: { valetId_siteId: { valetId, siteId } },
      create: { valetId, siteId },
      update: {},
    });
  },

  async removeSite(valetId: string, siteId: string): Promise<void> {
    await prisma.valetSiteAssignment.deleteMany({ where: { valetId, siteId } });
  },

  getAssignedSiteIds(valetId: string): Promise<{ siteId: string }[]> {
    return prisma.valetSiteAssignment.findMany({ where: { valetId }, select: { siteId: true } });
  },
};
