import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { organizationRepository } from '../repositories/organization.repository';
import { parkingRepository, type ParkingEntryFull, type ScopedParkingFilter } from '../repositories/parking.repository';
import { siteRepository } from '../repositories/site.repository';
import { vehicleRepository, type VehicleWithOwner } from '../repositories/vehicle.repository';
import { ApiError } from '../utils/apiError';
import { generateTicketCode } from '../utils/codes';
import { buildPaginatedResult } from '../utils/pagination';
import { signParkAuth, signParkSession, verifyParkAuth, verifyParkSession } from '../utils/parkingToken';
import { notificationService } from './notification.service';
import { recordAudit } from './audit.service';
import type { AuthenticatedUser, PaginatedResult, PaginationParams } from '../types';
import type { ParkingHistoryFilter, QuickRegisterInput } from '../validators/parking.validator';
import type { ParkingStatus } from '@prisma/client';

const ACTIVE: ParkingStatus[] = ['PARKED', 'PICKUP_REQUESTED', 'PICKUP_IN_PROGRESS'];

export interface PublicVehicleDisplay {
  vehicleNumber: string;
  vehicleType: string;
  brand: string | null;
  model: string | null;
  color: string | null;
  employeeName: string;
  employeeCode: string;
  organizationName: string;
}

export interface PublicParkingStatus {
  ticketCode: string;
  status: ParkingStatus;
  parkedAt: Date;
  pickedUpAt: Date | null;
  durationMinutes: number | null;
  vehicleNumber: string;
  vehicleType: string;
  brand: string | null;
  model: string | null;
  color: string | null;
  employeeName: string;
  organizationName: string;
  siteName: string;
  siteCode: string;
  valetName: string | null;
  pickupStatus: string | null;
  pickupAcceptedByName: string | null;
}

export interface PublicLookupResult {
  found: boolean;
  canParkAtSite: boolean;
  alreadyParked: boolean;
  vehicleNumber: string;
  parkToken?: string;
  sessionToken?: string;
  display?: PublicVehicleDisplay;
  parking?: PublicParkingStatus;
  site: { name: string; siteCode: string };
}

function toDisplay(vehicle: VehicleWithOwner): PublicVehicleDisplay {
  return {
    vehicleNumber: vehicle.vehicleNumber,
    vehicleType: vehicle.vehicleType,
    brand: vehicle.brand,
    model: vehicle.model,
    color: vehicle.color,
    employeeName: vehicle.employee.name,
    employeeCode: vehicle.employee.employeeCode,
    organizationName: vehicle.employee.organization.companyName,
  };
}

function toPublicStatus(entry: ParkingEntryFull): PublicParkingStatus {
  return {
    ticketCode: entry.ticketCode,
    status: entry.status,
    parkedAt: entry.parkedAt,
    pickedUpAt: entry.pickedUpAt,
    durationMinutes: entry.durationMinutes,
    vehicleNumber: entry.vehicle.vehicleNumber,
    vehicleType: entry.vehicle.vehicleType,
    brand: entry.vehicle.brand,
    model: entry.vehicle.model,
    color: entry.vehicle.color,
    employeeName: entry.employee.name,
    organizationName: entry.organization.companyName,
    siteName: entry.site.name,
    siteCode: entry.site.siteCode,
    valetName: entry.valet?.name ?? null,
    pickupStatus: entry.pickupRequest?.status ?? null,
    pickupAcceptedByName: entry.pickupRequest?.acceptedBy?.name ?? null,
  };
}

function sessionTokenFor(entry: ParkingEntryFull): string {
  return signParkSession({
    parkingEntryId: entry.id,
    ticketCode: entry.ticketCode,
    vehicleNumber: entry.vehicle.vehicleNumber,
    siteId: entry.site.id,
    siteCode: entry.site.siteCode,
  });
}

async function scopeFilter(actor: AuthenticatedUser, filter: ParkingHistoryFilter): Promise<ScopedParkingFilter> {
  if (actor.role === 'ORG_ADMIN') {
    if (!actor.organizationId) throw ApiError.forbidden('Your account is not linked to an organization');
    const siteIds = await organizationRepository.getSiteIds(actor.organizationId);
    if (filter.siteId && !siteIds.includes(filter.siteId)) {
      throw ApiError.forbidden('You are not assigned to this site');
    }
    return filter.siteId
      ? { ...filter, organizationId: actor.organizationId }
      : { ...filter, organizationId: actor.organizationId, siteIds };
  }
  if (actor.role === 'VALET') {
    const assignments = await prisma.valetSiteAssignment.findMany({
      where: { valetId: actor.id },
      select: { siteId: true },
    });
    const siteIds = assignments.map((a) => a.siteId);
    if (filter.siteId && !siteIds.includes(filter.siteId)) {
      throw ApiError.forbidden('You are not assigned to this site');
    }
    return filter.siteId ? filter : { ...filter, siteIds };
  }
  return filter;
}

export async function assertCanViewParking(actor: AuthenticatedUser, entry: ParkingEntryFull): Promise<void> {
  if (actor.role === 'SUPER_ADMIN') return;
  if (actor.role === 'ORG_ADMIN') {
    if (!actor.organizationId || entry.organization.id !== actor.organizationId) {
      throw ApiError.forbidden('You cannot access parking records of another organization');
    }
    return;
  }
  if (actor.role === 'VALET') {
    const assignment = await prisma.valetSiteAssignment.findUnique({
      where: { valetId_siteId: { valetId: actor.id, siteId: entry.site.id } },
    });
    if (!assignment) throw ApiError.forbidden('You are not assigned to this site');
  }
}

export const parkingService = {
  async history(
    actor: AuthenticatedUser,
    params: PaginationParams,
    filter: ParkingHistoryFilter,
  ): Promise<PaginatedResult<ParkingEntryFull>> {
    const scoped = await scopeFilter(actor, filter);
    if (scoped.siteIds && scoped.siteIds.length === 0) {
      return buildPaginatedResult<ParkingEntryFull>([], 0, params);
    }
    const { items, total } = await parkingRepository.findMany(params, scoped);
    return buildPaginatedResult(items, total, params);
  },

  exportHistory(actor: AuthenticatedUser, filter: ParkingHistoryFilter, search?: string): Promise<ParkingEntryFull[]> {
    return scopeFilter(actor, filter).then((scoped) => parkingRepository.findAllForExport(scoped, search));
  },

  async getById(actor: AuthenticatedUser, id: string): Promise<ParkingEntryFull> {
    const entry = await parkingRepository.findById(id);
    if (!entry) throw ApiError.notFound('Parking record not found');
    await assertCanViewParking(actor, entry);
    return entry;
  },

  async lookupVehicle(siteCode: string, vehicleNumber: string): Promise<PublicLookupResult> {
    const site = await siteRepository.findByCode(siteCode);
    if (!site || !site.isActive) throw ApiError.notFound('This parking site does not exist or is inactive');

    const vehicle = await vehicleRepository.findByNumber(vehicleNumber);
    const siteMeta = { name: site.name, siteCode: site.siteCode };

    if (!vehicle) {
      return { found: false, canParkAtSite: false, alreadyParked: false, vehicleNumber, site: siteMeta };
    }

    const org = vehicle.employee.organization;
    const assigned = await organizationRepository.isAssignedToSite(org.id, site.id);
    const activeParking = await parkingRepository.findActiveByVehicle(vehicle.id);
    const canParkAtSite = Boolean(
      assigned && org.isActive && vehicle.isActive && vehicle.employee.isActive,
    );

    if (activeParking) {
      const atThisSite = activeParking.site.siteCode === site.siteCode;
      return {
        found: true,
        canParkAtSite,
        alreadyParked: true,
        vehicleNumber: vehicle.vehicleNumber,
        display: toDisplay(vehicle),
        parking: atThisSite ? toPublicStatus(activeParking) : undefined,
        sessionToken: atThisSite ? sessionTokenFor(activeParking) : undefined,
        site: siteMeta,
      };
    }

    return {
      found: true,
      canParkAtSite,
      alreadyParked: false,
      vehicleNumber: vehicle.vehicleNumber,
      display: toDisplay(vehicle),
      parkToken: canParkAtSite
        ? signParkAuth({ vehicleId: vehicle.id, siteId: site.id, siteCode: site.siteCode })
        : undefined,
      site: siteMeta,
    };
  },

  async quickRegister(
    siteCode: string,
    input: QuickRegisterInput,
  ): Promise<{ parkToken: string; display: PublicVehicleDisplay; site: { name: string; siteCode: string } }> {
    const site = await siteRepository.findByCode(siteCode);
    if (!site || !site.isActive) throw ApiError.notFound('This parking site does not exist or is inactive');

    const existingVehicle = await vehicleRepository.findByNumber(input.vehicleNumber);
    if (existingVehicle) throw ApiError.conflict('This vehicle is already registered');

    const org = await prisma.organization.findUnique({ where: { id: input.employee.organizationId } });
    if (!org || !org.isActive) throw ApiError.badRequest('Selected organization is not available');

    const assigned = await organizationRepository.isAssignedToSite(org.id, site.id);
    if (!assigned) throw ApiError.forbidden('This organization is not assigned to this parking site');

    const email = input.employee.email.toLowerCase();
    const vehicle = await prisma.$transaction(async (tx) => {
      const sameOrg = await tx.employee.findFirst({ where: { email, organizationId: org.id } });
      const otherOrg = sameOrg ? null : await tx.employee.findUnique({ where: { email } });
      if (otherOrg) {
        throw ApiError.conflict('This email is already registered to another organization');
      }

      const employee =
        sameOrg ??
        (await tx.employee.create({
          data: {
            employeeCode: input.employee.employeeCode,
            name: input.employee.name,
            email,
            phone: input.employee.phone,
            organizationId: org.id,
          },
        }));

      if (!employee.isActive) throw ApiError.forbidden('This employee is inactive');

      return tx.vehicle.create({
        data: {
          vehicleNumber: input.vehicleNumber,
          vehicleType: input.vehicleType,
          brand: input.brand || null,
          model: input.model || null,
          color: input.color || null,
          fuelType: input.fuelType,
          employeeId: employee.id,
        },
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              employeeCode: true,
              email: true,
              phone: true,
              isActive: true,
              organization: { select: { id: true, name: true, companyName: true } },
            },
          },
        },
      });
    });

    return {
      parkToken: signParkAuth({ vehicleId: vehicle.id, siteId: site.id, siteCode: site.siteCode }),
      display: toDisplay(vehicle as VehicleWithOwner),
      site: { name: site.name, siteCode: site.siteCode },
    };
  },

  async parkVehicle(
    siteCode: string,
    parkToken: string,
    notes?: string,
  ): Promise<{ sessionToken: string; parking: PublicParkingStatus }> {
    const claims = verifyParkAuth(parkToken);
    if (claims.siteCode !== siteCode) {
      throw ApiError.forbidden('Parking authorization is not valid for this site');
    }

    const site = await siteRepository.findByCode(siteCode);
    if (!site || !site.isActive) throw ApiError.notFound('This parking site does not exist or is inactive');
    if (site.id !== claims.siteId) throw ApiError.forbidden('Parking authorization is not valid for this site');

    try {
      const entryId = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM sites WHERE id = ${site.id} FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM vehicles WHERE id = ${claims.vehicleId} FOR UPDATE`;

        const vehicle = await tx.vehicle.findUnique({
          where: { id: claims.vehicleId },
          include: {
            employee: { include: { organization: true } },
          },
        });
        if (!vehicle) throw ApiError.notFound('Vehicle not found');
        if (!vehicle.isActive) throw ApiError.forbidden('This vehicle is inactive');
        if (!vehicle.employee.isActive) throw ApiError.forbidden('This employee is inactive');
        if (!vehicle.employee.organization.isActive) throw ApiError.forbidden('This organization is inactive');

        const assigned = await tx.organizationSiteAssignment.findUnique({
          where: {
            organizationId_siteId: {
              organizationId: vehicle.employee.organization.id,
              siteId: site.id,
            },
          },
        });
        if (!assigned) {
          throw ApiError.forbidden(
            `Employees from ${vehicle.employee.organization.companyName} cannot park at this site`,
          );
        }

        const alreadyParked = await tx.parkingEntry.findFirst({
          where: { vehicleId: vehicle.id, status: { in: ACTIVE } },
        });
        if (alreadyParked) {
          throw ApiError.conflict('This vehicle is already parked');
        }

        if (assigned.allocatedSpaces > 0) {
          const orgOccupied = await tx.parkingEntry.count({
            where: {
              organizationId: vehicle.employee.organization.id,
              siteId: site.id,
              status: { in: ACTIVE },
            },
          });
          if (orgOccupied >= assigned.allocatedSpaces) {
            throw ApiError.conflict(
              `${vehicle.employee.organization.companyName} has used all ${assigned.allocatedSpaces} allocated spaces at ${site.name}`,
            );
          }
        }

        const occupied = await tx.parkingEntry.count({
          where: { siteId: site.id, status: { in: ACTIVE } },
        });
        if (occupied >= site.totalCapacity) {
          throw ApiError.conflict('This parking site is currently full');
        }

        const created = await tx.parkingEntry.create({
          data: {
            ticketCode: generateTicketCode(),
            status: 'PARKED',
            vehicleId: vehicle.id,
            employeeId: vehicle.employee.id,
            organizationId: vehicle.employee.organization.id,
            siteId: site.id,
            ...(notes ? { notes } : {}),
          },
        });
        return created.id;
      });

      const entry = await parkingRepository.findById(entryId);
      if (!entry) throw ApiError.internal('Parking record missing after create');

      await notificationService.notifySiteValets(site.id, {
        type: 'VEHICLE_PARKED',
        title: 'Vehicle parked',
        message: `${entry.vehicle.vehicleNumber} parked at ${site.name}`,
        data: { parkingEntryId: entry.id, siteId: site.id },
      });

      await recordAudit({
        action: 'VEHICLE_PARKED',
        entity: 'ParkingEntry',
        entityId: entry.id,
        metadata: { vehicleNumber: entry.vehicle.vehicleNumber, siteCode },
      });

      return { sessionToken: sessionTokenFor(entry), parking: toPublicStatus(entry) };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw ApiError.conflict('This vehicle is already parked');
      }
      throw error;
    }
  },

  async getPublicSession(sessionToken: string): Promise<PublicParkingStatus> {
    const claims = verifyParkSession(sessionToken);
    const entry = await parkingRepository.findById(claims.parkingEntryId);
    if (!entry) throw ApiError.notFound('Parking record not found');
    if (entry.ticketCode !== claims.ticketCode || entry.vehicle.vehicleNumber !== claims.vehicleNumber) {
      throw ApiError.forbidden('Parking session does not match this record');
    }
    return toPublicStatus(entry);
  },

  toPublicStatus,
  sessionTokenFor,
};
