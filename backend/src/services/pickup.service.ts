import { differenceInMinutes } from 'date-fns';
import type { PickupStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { parkingRepository } from '../repositories/parking.repository';
import { pickupRepository, type PickupRequestFull } from '../repositories/pickup.repository';
import { ApiError } from '../utils/apiError';
import { buildPaginatedResult } from '../utils/pagination';
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
    if (actor.role === 'VALET') {
      const assignments = await prisma.valetSiteAssignment.findMany({
        where: { valetId: actor.id },
        select: { siteId: true },
      });
      siteIds = assignments.map((a) => a.siteId);
      if (siteIds.length === 0) return buildPaginatedResult<PickupRequestFull>([], 0, params);
    }

    const { items, total } = await pickupRepository.findMany({ ...params, siteIds });
    return buildPaginatedResult(items, total, params);
  },

  /** Public: employee presses "GET MY CAR" from the QR page. */
  async requestPickup(parkingEntryId: string): Promise<PickupRequestFull> {
    const entry = await parkingRepository.findById(parkingEntryId);
    if (!entry) throw ApiError.notFound('Parking record not found');
    if (entry.status !== 'PARKED') {
      throw ApiError.conflict(
        entry.status === 'COMPLETED' ? 'This vehicle has already been picked up' : 'A pickup is already in progress for this vehicle',
      );
    }

    const [pickup] = await Promise.all([
      pickupRepository.create(parkingEntryId),
      parkingRepository.update(parkingEntryId, { status: 'PICKUP_REQUESTED' }),
    ]);

    await notificationService.notifySiteValets(entry.site.id, {
      type: 'PICKUP_REQUESTED',
      title: 'Pickup requested',
      message: `${entry.vehicle.vehicleNumber} — ${entry.employee.name} is waiting at ${entry.site.name}`,
      data: { pickupRequestId: pickup.id, parkingEntryId, siteId: entry.site.id },
    });

    await recordAudit({ action: 'PICKUP_REQUESTED', entity: 'PickupRequest', entityId: pickup.id, metadata: { vehicleNumber: entry.vehicle.vehicleNumber } });
    return pickup;
  },

  /** Valet accepts a pending pickup. First-come-first-served via conditional update. */
  async acceptPickup(actor: AuthenticatedUser, pickupId: string): Promise<PickupRequestFull> {
    const pickup = await pickupRepository.findById(pickupId);
    if (!pickup) throw ApiError.notFound('Pickup request not found');
    await assertValetSiteAccess(actor.id, pickup.parkingEntry.site.id);

    // Guard against two valets accepting simultaneously.
    const claimed = await prisma.pickupRequest.updateMany({
      where: { id: pickupId, status: 'PENDING' },
      data: { status: 'ACCEPTED', acceptedById: actor.id, acceptedAt: new Date() },
    });
    if (claimed.count === 0) {
      throw ApiError.conflict('This pickup has already been accepted by another valet');
    }

    await parkingRepository.update(pickup.parkingEntry.id, {
      status: 'PICKUP_IN_PROGRESS',
      valet: { connect: { id: actor.id } },
    });

    await recordAudit({ userId: actor.id, action: 'PICKUP_ACCEPTED', entity: 'PickupRequest', entityId: pickupId });
    const updated = await pickupRepository.findById(pickupId);
    if (!updated) throw ApiError.internal('Pickup state error');
    return updated;
  },

  /** Valet delivers the vehicle and completes the pickup. */
  async completePickup(actor: AuthenticatedUser, pickupId: string): Promise<PickupRequestFull> {
    const pickup = await pickupRepository.findById(pickupId);
    if (!pickup) throw ApiError.notFound('Pickup request not found');
    if (pickup.status !== 'ACCEPTED') {
      throw ApiError.conflict('Only accepted pickups can be completed');
    }
    if (pickup.acceptedBy?.id !== actor.id && actor.role === 'VALET') {
      throw ApiError.forbidden('Only the valet who accepted this pickup can complete it');
    }

    const now = new Date();
    const entry = await parkingRepository.findById(pickup.parkingEntry.id);
    if (!entry) throw ApiError.internal('Parking record missing');

    const durationMinutes = differenceInMinutes(now, entry.parkedAt);

    const [updated] = await Promise.all([
      pickupRepository.update(pickupId, { status: 'COMPLETED', completedAt: now }),
      parkingRepository.update(entry.id, {
        status: 'COMPLETED',
        pickedUpAt: now,
        durationMinutes,
        valet: { connect: { id: actor.id } },
      }),
    ]);

    await notificationService.notifyRole('SUPER_ADMIN', {
      type: 'PICKUP_COMPLETED',
      title: 'Pickup completed',
      message: `${entry.vehicle.vehicleNumber} delivered at ${entry.site.name} by ${actor.name}`,
      data: { pickupRequestId: pickupId, parkingEntryId: entry.id },
    });

    await recordAudit({ userId: actor.id, action: 'PICKUP_COMPLETED', entity: 'PickupRequest', entityId: pickupId, metadata: { durationMinutes } });
    return updated;
  },
};
