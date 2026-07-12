import type { Request, Response } from 'express';
import { vehicleService } from '../services/vehicle.service';
import { asyncHandler } from '../utils/asyncHandler';
import { param } from '../utils/request';
import { getPagination } from '../utils/pagination';
import { sendPaginated, sendSuccess } from '../utils/response';
import { ApiError } from '../utils/apiError';
import type { CreateVehicleInput, UpdateVehicleInput } from '../validators/vehicle.validator';

export const vehicleController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const params = getPagination(req);
    const organizationId = typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined;
    const employeeId = typeof req.query.employeeId === 'string' ? req.query.employeeId : undefined;
    const result = await vehicleService.list(req.user, { ...params, organizationId, employeeId });
    sendPaginated(res, result);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const vehicle = await vehicleService.getById(req.user, param(req, 'id'));
    sendSuccess(res, vehicle);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const vehicle = await vehicleService.create(req.user, req.body as CreateVehicleInput);
    sendSuccess(res, vehicle, 201, 'Vehicle registered successfully');
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const vehicle = await vehicleService.update(req.user, param(req, 'id'), req.body as UpdateVehicleInput);
    sendSuccess(res, vehicle, 200, 'Vehicle updated successfully');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    await vehicleService.remove(req.user, param(req, 'id'));
    sendSuccess(res, null, 200, 'Vehicle deleted successfully');
  }),
};
