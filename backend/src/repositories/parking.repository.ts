import type { ParkingEntry, ParkingStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { PaginationParams } from '../types';
import { toSkipTake } from '../utils/pagination';
import type { ParkingHistoryFilter } from '../validators/parking.validator';

const parkingInclude = {
  include: {
    vehicle: { select: { id: true, vehicleNumber: true, vehicleType: true, brand: true, model: true, color: true } },
    employee: { select: { id: true, name: true, employeeCode: true, phone: true, email: true } },
    organization: { select: { id: true, name: true, companyName: true } },
    site: { select: { id: true, name: true, siteCode: true, address: true } },
    valet: { select: { id: true, name: true, phone: true } },
    pickupRequest: {
      select: {
        id: true,
        status: true,
        requestedAt: true,
        acceptedAt: true,
        completedAt: true,
        acceptedBy: { select: { id: true, name: true } },
      },
    },
  },
} satisfies Prisma.ParkingEntryDefaultArgs;

export type ParkingEntryFull = Prisma.ParkingEntryGetPayload<typeof parkingInclude>;

const ACTIVE_STATUSES: ParkingStatus[] = ['PARKED', 'PICKUP_REQUESTED', 'PICKUP_IN_PROGRESS'];

export type ScopedParkingFilter = ParkingHistoryFilter & { siteIds?: string[] };

function buildWhere(filter: ScopedParkingFilter, search?: string): Prisma.ParkingEntryWhereInput {
  return {
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.siteId ? { siteId: filter.siteId } : filter.siteIds ? { siteId: { in: filter.siteIds } } : {}),
    ...(filter.organizationId ? { organizationId: filter.organizationId } : {}),
    ...(filter.employeeId ? { employeeId: filter.employeeId } : {}),
    ...(filter.vehicleId ? { vehicleId: filter.vehicleId } : {}),
    ...(filter.valetId ? { valetId: filter.valetId } : {}),
    ...(filter.dateFrom || filter.dateTo
      ? { parkedAt: { ...(filter.dateFrom ? { gte: filter.dateFrom } : {}), ...(filter.dateTo ? { lte: filter.dateTo } : {}) } }
      : {}),
    ...(search
      ? {
          OR: [
            { ticketCode: { contains: search, mode: 'insensitive' } },
            { vehicle: { vehicleNumber: { contains: search.toUpperCase().replace(/[\s-]/g, ''), mode: 'insensitive' } } },
            { employee: { name: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
}

export const parkingRepository = {
  ACTIVE_STATUSES,

  async findMany(
    params: PaginationParams,
    filter: ScopedParkingFilter,
  ): Promise<{ items: ParkingEntryFull[]; total: number }> {
    const where = buildWhere(filter, params.search);
    const orderBy: Prisma.ParkingEntryOrderByWithRelationInput = params.sortBy
      ? { [params.sortBy]: params.sortOrder }
      : { parkedAt: 'desc' };

    const [items, total] = await prisma.$transaction([
      prisma.parkingEntry.findMany({ where, orderBy, ...toSkipTake(params), ...parkingInclude }),
      prisma.parkingEntry.count({ where }),
    ]);
    return { items, total };
  },

  /** Unpaginated export query, capped to keep exports bounded. */
  findAllForExport(filter: ScopedParkingFilter, search?: string): Promise<ParkingEntryFull[]> {
    return prisma.parkingEntry.findMany({
      where: buildWhere(filter, search),
      orderBy: { parkedAt: 'desc' },
      take: 10000,
      ...parkingInclude,
    });
  },

  findById(id: string): Promise<ParkingEntryFull | null> {
    return prisma.parkingEntry.findUnique({ where: { id }, ...parkingInclude });
  },

  findActiveByVehicle(vehicleId: string): Promise<ParkingEntryFull | null> {
    return prisma.parkingEntry.findFirst({
      where: { vehicleId, status: { in: ACTIVE_STATUSES } },
      ...parkingInclude,
    });
  },

  findActiveByEmployee(employeeId: string): Promise<ParkingEntryFull[]> {
    return prisma.parkingEntry.findMany({
      where: { employeeId, status: { in: ACTIVE_STATUSES } },
      orderBy: { parkedAt: 'desc' },
      ...parkingInclude,
    });
  },

  create(data: Prisma.ParkingEntryCreateInput): Promise<ParkingEntryFull> {
    return prisma.parkingEntry.create({ data, ...parkingInclude });
  },

  update(id: string, data: Prisma.ParkingEntryUpdateInput): Promise<ParkingEntryFull> {
    return prisma.parkingEntry.update({ where: { id }, data, ...parkingInclude });
  },

  countActiveInSite(siteId: string): Promise<number> {
    return prisma.parkingEntry.count({ where: { siteId, status: { in: ACTIVE_STATUSES } } });
  },

  countToday(where: Prisma.ParkingEntryWhereInput = {}): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return prisma.parkingEntry.count({ where: { ...where, parkedAt: { gte: startOfDay } } });
  },
};

export type { ParkingEntry };
