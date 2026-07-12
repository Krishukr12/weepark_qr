import type { Request, Response } from 'express';
import { PickupStatus } from '@prisma/client';
import { pickupService } from '../services/pickup.service';
import { asyncHandler } from '../utils/asyncHandler';
import { param } from '../utils/request';
import { getPagination } from '../utils/pagination';
import { sendPaginated, sendSuccess } from '../utils/response';
import { ApiError } from '../utils/apiError';

export const pickupController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const params = getPagination(req);
    const status =
      typeof req.query.status === 'string' && req.query.status in PickupStatus
        ? (req.query.status as PickupStatus)
        : undefined;
    const result = await pickupService.list(req.user, { ...params, status });
    sendPaginated(res, result);
  }),

  /** Public — triggered from the QR page "GET MY CAR" button. */
  request: asyncHandler(async (req: Request, res: Response) => {
    const { parkingEntryId } = req.body as { parkingEntryId: string };
    const pickup = await pickupService.requestPickup(parkingEntryId);
    sendSuccess(res, pickup, 201, 'Pickup requested — a valet is on the way');
  }),

  accept: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const pickup = await pickupService.acceptPickup(req.user, param(req, 'id'));
    sendSuccess(res, pickup, 200, 'Pickup accepted');
  }),

  complete: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const pickup = await pickupService.completePickup(req.user, param(req, 'id'));
    sendSuccess(res, pickup, 200, 'Pickup completed');
  }),
};
