import { differenceInMinutes } from 'date-fns';
import type { PickupStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { parkingRepository } from '../repositories/parking.repository';
import { pickupRepository, type PickupRequestFull } from '../repositories/pickup.repository';
import { ApiError } from '../utils/apiError';
import { buildPaginatedResult } from '../utils/pagination';
import { verifyParkSession } from '../utils/parkingToken';
import { notificationService } from './notification.service';
import { recordAudit } from './audit.service';
import type { AuthenticatedUser, PaginatedResult, PaginationParams } from '../types';

async function assertValetSiteAccess(valetId: string, siteId: string): Promise<void> {
  const assignment = await prisma.valetSiteAssignment.findUnique({
    where: { valetId_siteId: { valetId, siteId } },
  });
  if (!assignment) throw ApiError.forbidden('You are not assigned to this site');
}

export const pickupService = {
  async list(
    actor: AuthenticatedUser,
    params: PaginationParams & { status?: PickupStatus },
  ): Promise<PaginatedResult<PickupRequestFull>> {
    let siteIds: string[] | undefined;
    let organizationId: string | undefined;

    if (actor.role === 'VALET') {
      const assignments = await prisma.valetSiteAssignment.findMany({
        where: { valetId: actor.id },
        select: { siteId: true },
      });
      siteIds = assignments.map((a) => a.siteId);
      if (siteIds.length === 0) return buildPaginatedResult<PickupRequestFull>([], 0, params);
    } else if (actor.role === 'ORG_ADMIN') {
      if (!actor.organizationId) throw ApiError.forbidden('Your account is not linked to an organization');
      organizationId = actor.organizationId;
    }

    const { items, total } = await pickupRepository.findMany({ ...params, siteIds, organizationId });
    return buildPaginatedResult(items, total, params);
  },

  async requestPickup(sessionToken: string, vehicleNumber: string, ticketCode: string): Promise<PickupRequestFull> {
    const claims = verifyParkSession(sessionToken);
    if (claims.vehicleNumber !== vehicleNumber || claims.ticketCode !== ticketCode) {
      throw ApiError.forbidden('Pickup confirmation does not match this parking session');
    }

    const pickupId = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM parking_entries WHERE id = ${claims.parkingEntryId} FOR UPDATE`;
      const entry = await tx.parkingEntry.findUnique({
        where: { id: claims.parkingEntryId },
        include: { vehicle: { select: { vehicleNumber: true } } },
      });
      if (!entry) throw ApiError.notFound('Parking record not found');
      if (entry.ticketCode !== ticketCode || entry.vehicle.vehicleNumber !== vehicleNumber) {
        throw ApiError.forbidden('Pickup confirmation does not match this parking session');
      }
      if (entry.status !== 'PARKED') {
        throw ApiError.conflict(
          entry.status === 'COMPLETED'
            ? 'This vehicle has already been picked up'
            : 'A pickup is already in progress for this vehicle',
        );
      }

      const pickup = await tx.pickupRequest.create({ data: { parkingEntryId: entry.id } });
      await tx.parkingEntry.update({ where: { id: entry.id }, data: { status: 'PICKUP_REQUESTED' } });
      return pickup.id;
    });

    const pickup = await pickupRepository.findById(pickupId);
    if (!pickup) throw ApiError.internal('Pickup state error');

    await notificationService.notifySiteValets(pickup.parkingEntry.site.id, {
      type: 'PICKUP_REQUESTED',
      title: 'Pickup requested',
      message: `${pickup.parkingEntry.vehicle.vehicleNumber} — ${pickup.parkingEntry.employee.name} is waiting at ${pickup.parkingEntry.site.name}`,
      data: { pickupRequestId: pickup.id, parkingEntryId: claims.parkingEntryId, siteId: pickup.parkingEntry.site.id },
    });

    await recordAudit({
      action: 'PICKUP_REQUESTED',
      entity: 'PickupRequest',
      entityId: pickup.id,
      metadata: { vehicleNumber: pickup.parkingEntry.vehicle.vehicleNumber },
    });
    return pickup;
  },

  async acceptPickup(actor: AuthenticatedUser, pickupId: string): Promise<PickupRequestFull> {
    const pickup = await pickupRepository.findById(pickupId);
    if (!pickup) throw ApiError.notFound('Pickup request not found');
    await assertValetSiteAccess(actor.id, pickup.parkingEntry.site.id);

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.pickupRequest.updateMany({
        where: { id: pickupId, status: 'PENDING' },
        data: { status: 'ACCEPTED', acceptedById: actor.id, acceptedAt: new Date() },
      });
      if (claimed.count === 0) {
        throw ApiError.conflict('This pickup has already been accepted by another valet');
      }
      await tx.parkingEntry.update({
        where: { id: pickup.parkingEntry.id },
        data: { status: 'PICKUP_IN_PROGRESS', valetId: actor.id },
      });
    });

    await recordAudit({ userId: actor.id, action: 'PICKUP_ACCEPTED', entity: 'PickupRequest', entityId: pickupId });
    const updated = await pickupRepository.findById(pickupId);
    if (!updated) throw ApiError.internal('Pickup state error');
    return updated;
  },

  async completePickup(actor: AuthenticatedUser, pickupId: string): Promise<PickupRequestFull> {
    const pickup = await pickupRepository.findById(pickupId);
    if (!pickup) throw ApiError.notFound('Pickup request not found');
    if (pickup.status !== 'ACCEPTED') {
      throw ApiError.conflict('Only accepted pickups can be completed');
    }
    if (pickup.acceptedBy?.id !== actor.id && actor.role === 'VALET') {
      throw ApiError.forbidden('Only the valet who accepted this pickup can complete it');
    }
    if (actor.role === 'VALET') {
      await assertValetSiteAccess(actor.id, pickup.parkingEntry.site.id);
    }

    const now = new Date();
    const entry = await parkingRepository.findById(pickup.parkingEntry.id);
    if (!entry) throw ApiError.internal('Parking record missing');
    const durationMinutes = differenceInMinutes(now, entry.parkedAt);

    const [updated] = await prisma.$transaction([
      prisma.pickupRequest.update({
        where: { id: pickupId },
        data: { status: 'COMPLETED', completedAt: now },
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
      }),
      prisma.parkingEntry.update({
        where: { id: entry.id },
        data: {
          status: 'COMPLETED',
          pickedUpAt: now,
          durationMinutes,
          valetId: actor.id,
        },
      }),
    ]);

    await notificationService.notifyRole('SUPER_ADMIN', {
      type: 'PICKUP_COMPLETED',
      title: 'Pickup completed',
      message: `${entry.vehicle.vehicleNumber} delivered at ${entry.site.name} by ${actor.name}`,
      data: { pickupRequestId: pickupId, parkingEntryId: entry.id },
    });

    await recordAudit({
      userId: actor.id,
      action: 'PICKUP_COMPLETED',
      entity: 'PickupRequest',
      entityId: pickupId,
      metadata: { durationMinutes },
    });
    return updated;
  },
};
