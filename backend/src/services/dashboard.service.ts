import { startOfDay, subDays, format } from 'date-fns';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { organizationRepository } from '../repositories/organization.repository';
import { ApiError } from '../utils/apiError';
import type { AuthenticatedUser } from '../types';

export interface DashboardStats {
  todaysParking: number;
  currentParked: number;
  todaysPickups: number;
  availableSpaces: number;
  occupiedSpaces: number;
  totalCapacity: number;
  organizations: number;
  employees: number;
  vehicles: number;
  sites: number;
  valets: number;
  pendingPickups: number;
}

export interface TrendPoint {
  date: string;
  parkings: number;
  pickups: number;
}

export interface PeakHourPoint {
  hour: string;
  count: number;
}

export interface UsagePoint {
  name: string;
  count: number;
}

const ACTIVE: Prisma.ParkingEntryWhereInput = { status: { in: ['PARKED', 'PICKUP_REQUESTED', 'PICKUP_IN_PROGRESS'] } };

/** Role-scoped where clause for parking aggregates. */
async function parkingScope(actor: AuthenticatedUser): Promise<Prisma.ParkingEntryWhereInput> {
  if (actor.role === 'ORG_ADMIN') {
    if (!actor.organizationId) throw ApiError.forbidden('Your account is not linked to an organization');
    const siteIds = await organizationRepository.getSiteIds(actor.organizationId);
    return { organizationId: actor.organizationId, siteId: { in: siteIds } };
  }
  if (actor.role === 'VALET') {
    const assignments = await prisma.valetSiteAssignment.findMany({
      where: { valetId: actor.id },
      select: { siteId: true },
    });
    return { siteId: { in: assignments.map((a) => a.siteId) } };
  }
  return {};
}

/** SQL predicate matching a Prisma parking scope (org and/or site ids). */
function scopePredicate(scope: Prisma.ParkingEntryWhereInput): Prisma.Sql {
  const parts: Prisma.Sql[] = [];
  if (typeof scope.organizationId === 'string') {
    parts.push(Prisma.sql`"organizationId" = ${scope.organizationId}`);
  }
  if (scope.siteId && typeof scope.siteId === 'object' && 'in' in scope.siteId) {
    const ids = (scope.siteId.in ?? []) as string[];
    if (ids.length === 0) return Prisma.sql`FALSE`;
    parts.push(Prisma.sql`"siteId" IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}`))})`);
  }
  if (parts.length === 0) return Prisma.sql`TRUE`;
  return Prisma.join(parts, ' AND ');
}

function toCount(value: bigint | number): number {
  return typeof value === 'bigint' ? Number(value) : value;
}

export const dashboardService = {
  async getStats(actor: AuthenticatedUser): Promise<DashboardStats> {
    const scope = await parkingScope(actor);
    const today = startOfDay(new Date());

    const siteScope: Prisma.SiteWhereInput =
      actor.role === 'VALET'
        ? { valetAssignments: { some: { valetId: actor.id } } }
        : actor.role === 'ORG_ADMIN' && actor.organizationId
          ? { organizationAssignments: { some: { organizationId: actor.organizationId } } }
          : {};

    const [todaysParking, currentParked, todaysPickups, pendingPickups, sitesAgg, organizations, employees, vehicles, sites, valets] =
      await Promise.all([
        prisma.parkingEntry.count({ where: { ...scope, parkedAt: { gte: today } } }),
        prisma.parkingEntry.count({ where: { ...scope, ...ACTIVE } }),
        prisma.parkingEntry.count({ where: { ...scope, status: 'COMPLETED', pickedUpAt: { gte: today } } }),
        prisma.pickupRequest.count({
          where: { status: 'PENDING', parkingEntry: scope as Prisma.ParkingEntryWhereInput },
        }),
        prisma.site.aggregate({ where: { isActive: true, ...siteScope }, _sum: { totalCapacity: true } }),
        actor.role === 'SUPER_ADMIN' ? prisma.organization.count({ where: { isActive: true } }) : Promise.resolve(0),
        prisma.employee.count({
          where:
            actor.role === 'ORG_ADMIN'
              ? { organizationId: actor.organizationId ?? '', isGuest: false }
              : actor.role === 'VALET'
                ? { id: { in: [] } }
                : { isGuest: false },
        }),
        prisma.vehicle.count({
          where:
            actor.role === 'ORG_ADMIN'
              ? { employee: { organizationId: actor.organizationId ?? '', isGuest: false } }
              : actor.role === 'VALET'
                ? { id: { in: [] } }
                : { employee: { isGuest: false } },
        }),
        prisma.site.count({ where: { isActive: true, ...siteScope } }),
        actor.role === 'SUPER_ADMIN' ? prisma.user.count({ where: { role: 'VALET', isActive: true } }) : Promise.resolve(0),
      ]);

    const totalCapacity = sitesAgg._sum.totalCapacity ?? 0;

    return {
      todaysParking,
      currentParked,
      todaysPickups,
      pendingPickups,
      availableSpaces: Math.max(0, totalCapacity - currentParked),
      occupiedSpaces: currentParked,
      totalCapacity,
      organizations,
      employees,
      vehicles,
      sites,
      valets,
    };
  },

  /** Daily parking/pickup counts over the trailing N days. */
  async getParkingTrend(actor: AuthenticatedUser, days = 14): Promise<TrendPoint[]> {
    const scope = await parkingScope(actor);
    const from = startOfDay(subDays(new Date(), days - 1));
    const pred = scopePredicate(scope);

    const [parkedRows, pickupRows] = await Promise.all([
      prisma.$queryRaw<Array<{ day: Date; count: bigint | number }>>`
        SELECT DATE_TRUNC('day', "parkedAt") AS day, COUNT(*)::int AS count
        FROM parking_entries
        WHERE "parkedAt" >= ${from} AND ${pred}
        GROUP BY 1
      `,
      prisma.$queryRaw<Array<{ day: Date; count: bigint | number }>>`
        SELECT DATE_TRUNC('day', "pickedUpAt") AS day, COUNT(*)::int AS count
        FROM parking_entries
        WHERE "pickedUpAt" IS NOT NULL AND "pickedUpAt" >= ${from} AND ${pred}
        GROUP BY 1
      `,
    ]);

    const buckets = new Map<string, TrendPoint>();
    for (let i = 0; i < days; i++) {
      const date = format(subDays(new Date(), days - 1 - i), 'yyyy-MM-dd');
      buckets.set(date, { date, parkings: 0, pickups: 0 });
    }

    for (const row of parkedRows) {
      const key = format(row.day, 'yyyy-MM-dd');
      const bucket = buckets.get(key);
      if (bucket) bucket.parkings = toCount(row.count);
    }
    for (const row of pickupRows) {
      const key = format(row.day, 'yyyy-MM-dd');
      const bucket = buckets.get(key);
      if (bucket) bucket.pickups = toCount(row.count);
    }

    return Array.from(buckets.values());
  },

  /** Hourly distribution of parkings over the trailing 30 days. */
  async getPeakHours(actor: AuthenticatedUser): Promise<PeakHourPoint[]> {
    const scope = await parkingScope(actor);
    const from = subDays(new Date(), 30);
    const pred = scopePredicate(scope);

    const rows = await prisma.$queryRaw<Array<{ hour: number; count: bigint | number }>>`
      SELECT EXTRACT(HOUR FROM "parkedAt")::int AS hour, COUNT(*)::int AS count
      FROM parking_entries
      WHERE "parkedAt" >= ${from} AND ${pred}
      GROUP BY 1
    `;

    const hours = new Array<number>(24).fill(0);
    for (const row of rows) {
      const hour = Number(row.hour);
      if (hour >= 0 && hour < 24) hours[hour] = toCount(row.count);
    }

    return hours.map((count, hour) => ({
      hour: `${String(hour).padStart(2, '0')}:00`,
      count,
    }));
  },

  async getOrganizationUsage(actor: AuthenticatedUser): Promise<UsagePoint[]> {
    if (actor.role !== 'SUPER_ADMIN') return [];
    const from = subDays(new Date(), 30);
    const grouped = await prisma.parkingEntry.groupBy({
      by: ['organizationId'],
      where: { parkedAt: { gte: from } },
      _count: { _all: true },
      orderBy: { _count: { organizationId: 'desc' } },
      take: 8,
    });

    const orgs = await prisma.organization.findMany({
      where: { id: { in: grouped.map((g) => g.organizationId) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(orgs.map((o) => [o.id, o.name]));

    return grouped.map((g) => ({
      name: nameById.get(g.organizationId) ?? 'Unknown',
      count: g._count._all,
    }));
  },

  async getSiteUsage(actor: AuthenticatedUser): Promise<UsagePoint[]> {
    const scope = await parkingScope(actor);
    const from = subDays(new Date(), 30);
    const grouped = await prisma.parkingEntry.groupBy({
      by: ['siteId'],
      where: { ...scope, parkedAt: { gte: from } },
      _count: { _all: true },
      orderBy: { _count: { siteId: 'desc' } },
      take: 8,
    });

    const sites = await prisma.site.findMany({
      where: { id: { in: grouped.map((g) => g.siteId) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(sites.map((s) => [s.id, s.name]));

    return grouped.map((g) => ({
      name: nameById.get(g.siteId) ?? 'Unknown',
      count: g._count._all,
    }));
  },
};
