import { prisma } from '../config/prisma';
import { parkingRepository, type ParkingEntryFull, type ScopedParkingFilter } from '../repositories/parking.repository';
import { siteRepository } from '../repositories/site.repository';
import { vehicleRepository, type VehicleWithOwner } from '../repositories/vehicle.repository';
import { ApiError } from '../utils/apiError';
import { generateTicketCode } from '../utils/codes';
import { buildPaginatedResult } from '../utils/pagination';
import { notificationService } from './notification.service';
import { recordAudit } from './audit.service';
import type { AuthenticatedUser, PaginatedResult, PaginationParams } from '../types';
import type { ParkingHistoryFilter, QuickRegisterInput } from '../validators/parking.validator';
import type { Site } from '@prisma/client';

export interface VehicleLookupResult {
  found: boolean;
  vehicle: VehicleWithOwner | null;
  activeParking: ParkingEntryFull | null;
}

/** Applies role-based scoping so each role only ever sees its own slice of history. */
async function scopeFilter(actor: AuthenticatedUser, filter: ParkingHistoryFilter): Promise<ScopedParkingFilter> {
  if (actor.role === 'ORG_ADMIN') {
    if (!actor.organizationId) throw ApiError.forbidden('Your account is not linked to an organization');
    return { ...filter, organizationId: actor.organizationId };
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

  async getById(id: string): Promise<ParkingEntryFull> {
    const entry = await parkingRepository.findById(id);
    if (!entry) throw ApiError.notFound('Parking record not found');
    return entry;
  },

  /** Public: QR page enters a vehicle number, we return everything we know. */
  async lookupVehicle(siteCode: string, vehicleNumber: string): Promise<VehicleLookupResult & { site: Pick<Site, 'id' | 'name' | 'siteCode'> }> {
    const site = await siteRepository.findByCode(siteCode);
    if (!site || !site.isActive) throw ApiError.notFound('This parking site does not exist or is inactive');

    const vehicle = await vehicleRepository.findByNumber(vehicleNumber);
    const activeParking = vehicle ? await parkingRepository.findActiveByVehicle(vehicle.id) : null;

    return {
      found: Boolean(vehicle),
      vehicle,
      activeParking,
      site: { id: site.id, name: site.name, siteCode: site.siteCode },
    };
  },

  /** Public: register an unknown vehicle (and employee if needed) from the QR page. */
  async quickRegister(siteCode: string, input: QuickRegisterInput): Promise<VehicleWithOwner> {
    const site = await siteRepository.findByCode(siteCode);
    if (!site || !site.isActive) throw ApiError.notFound('This parking site does not exist or is inactive');

    const existingVehicle = await vehicleRepository.findByNumber(input.vehicleNumber);
    if (existingVehicle) throw ApiError.conflict('This vehicle is already registered');

    const org = await prisma.organization.findUnique({ where: { id: input.employee.organizationId } });
    if (!org || !org.isActive) throw ApiError.badRequest('Selected organization is not available');

    const email = input.employee.email.toLowerCase();
    const vehicle = await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.upsert({
        where: { email },
        update: {},
        create: {
          employeeCode: input.employee.employeeCode,
          name: input.employee.name,
          email,
          phone: input.employee.phone,
          organizationId: org.id,
        },
      });

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
      });
    });

    const full = await vehicleRepository.findById(vehicle.id);
    if (!full) throw ApiError.internal('Vehicle registration failed');
    return full;
  },

  /** Public: "PARK MY VEHICLE" — creates the parking record. */
  async parkVehicle(siteCode: string, vehicleId: string, notes?: string): Promise<ParkingEntryFull> {
    const site = await siteRepository.findByCode(siteCode);
    if (!site || !site.isActive) throw ApiError.notFound('This parking site does not exist or is inactive');

    const vehicle = await vehicleRepository.findById(vehicleId);
    if (!vehicle) throw ApiError.notFound('Vehicle not found');

    const alreadyParked = await parkingRepository.findActiveByVehicle(vehicleId);
    if (alreadyParked) {
      throw ApiError.conflict(`This vehicle is already parked at ${alreadyParked.site.name}`);
    }

    const occupied = await parkingRepository.countActiveInSite(site.id);
    if (occupied >= site.totalCapacity) {
      throw ApiError.conflict('This parking site is currently full');
    }

    const entry = await parkingRepository.create({
      ticketCode: generateTicketCode(),
      status: 'PARKED',
      vehicle: { connect: { id: vehicleId } },
      employee: { connect: { id: vehicle.employee.id } },
      organization: { connect: { id: vehicle.employee.organization.id } },
      site: { connect: { id: site.id } },
      ...(notes ? { notes } : {}),
    });

    await notificationService.notifySiteValets(site.id, {
      type: 'VEHICLE_PARKED',
      title: 'Vehicle parked',
      message: `${vehicle.vehicleNumber} parked at ${site.name}`,
      data: { parkingEntryId: entry.id, siteId: site.id },
    });

    await recordAudit({ action: 'VEHICLE_PARKED', entity: 'ParkingEntry', entityId: entry.id, metadata: { vehicleNumber: vehicle.vehicleNumber, siteCode } });
    return entry;
  },

  /** Public: employee status view by vehicle number (for the QR page "my car" screen). */
  async getActiveParkingByVehicleNumber(vehicleNumber: string): Promise<ParkingEntryFull | null> {
    const vehicle = await vehicleRepository.findByNumber(vehicleNumber);
    if (!vehicle) return null;
    return parkingRepository.findActiveByVehicle(vehicle.id);
  },
};
