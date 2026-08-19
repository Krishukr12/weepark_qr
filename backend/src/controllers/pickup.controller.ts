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
    const params = getPagination(req, ['requestedAt', 'createdAt']);
    const status =
      typeof req.query.status === 'string' && Object.values(PickupStatus).includes(req.query.status as PickupStatus)
        ? (req.query.status as PickupStatus)
        : undefined;
    const result = await pickupService.list(req.user, { ...params, status });
    sendPaginated(res, result);
  }),

  request: asyncHandler(async (req: Request, res: Response) => {
    const { sessionToken, vehicleNumber, ticketCode } = req.body as {
      sessionToken: string;
      vehicleNumber: string;
      ticketCode: string;
    };
    const pickup = await pickupService.requestPickup(sessionToken, vehicleNumber, ticketCode);
    sendSuccess(res, { id: pickup.id, status: pickup.status, requestedAt: pickup.requestedAt }, 201, 'Pickup requested — a valet is on the way');
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
