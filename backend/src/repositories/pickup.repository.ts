import type { PickupStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { PaginationParams } from '../types';
import { toSkipTake } from '../utils/pagination';

const pickupInclude = {
  include: {
    parkingEntry: {
      include: {
        vehicle: { select: { id: true, vehicleNumber: true, vehicleType: true, brand: true, model: true, color: true } },
        employee: { select: { id: true, name: true, employeeCode: true, phone: true } },
        organization: { select: { id: true, name: true } },
        site: { select: { id: true, name: true, siteCode: true } },
      },
    },
    acceptedBy: { select: { id: true, name: true, phone: true } },
  },
} satisfies Prisma.PickupRequestDefaultArgs;

export type PickupRequestFull = Prisma.PickupRequestGetPayload<typeof pickupInclude>;

export const pickupRepository = {
  async findMany(
    params: PaginationParams & { status?: PickupStatus; siteIds?: string[]; acceptedById?: string },
  ): Promise<{ items: PickupRequestFull[]; total: number }> {
    const where: Prisma.PickupRequestWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.siteIds ? { parkingEntry: { siteId: { in: params.siteIds } } } : {}),
      ...(params.acceptedById ? { acceptedById: params.acceptedById } : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.pickupRequest.findMany({
        where,
        orderBy: { requestedAt: 'desc' },
        ...toSkipTake(params),
        ...pickupInclude,
      }),
      prisma.pickupRequest.count({ where }),
    ]);
    return { items, total };
  },

  findById(id: string): Promise<PickupRequestFull | null> {
    return prisma.pickupRequest.findUnique({ where: { id }, ...pickupInclude });
  },

  create(parkingEntryId: string): Promise<PickupRequestFull> {
    return prisma.pickupRequest.create({ data: { parkingEntryId }, ...pickupInclude });
  },

  update(id: string, data: Prisma.PickupRequestUpdateInput): Promise<PickupRequestFull> {
    return prisma.pickupRequest.update({ where: { id }, data, ...pickupInclude });
  },
};
