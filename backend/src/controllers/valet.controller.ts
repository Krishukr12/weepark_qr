import type { Request, Response } from 'express';
import { valetService } from '../services/valet.service';
import { asyncHandler } from '../utils/asyncHandler';
import { param } from '../utils/request';
import { getPagination } from '../utils/pagination';
import { sendPaginated, sendSuccess } from '../utils/response';
import { ApiError } from '../utils/apiError';
import type { CreateValetInput, UpdateValetInput } from '../validators/valet.validator';

export const valetController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const params = getPagination(req);
    const siteId = typeof req.query.siteId === 'string' ? req.query.siteId : undefined;
    const result = await valetService.list({ ...params, siteId });
    sendPaginated(res, result);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const valet = await valetService.getById(param(req, 'id'));
    sendSuccess(res, valet);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const valet = await valetService.create(req.body as CreateValetInput, req.user.id);
    sendSuccess(res, valet, 201, 'Valet created — credentials emailed');
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const valet = await valetService.update(param(req, 'id'), req.body as UpdateValetInput, req.user.id);
    sendSuccess(res, valet, 200, 'Valet updated successfully');
  }),

  deactivate: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    await valetService.deactivate(param(req, 'id'), req.user.id);
    sendSuccess(res, null, 200, 'Valet deactivated');
  }),

  assignSite: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    await valetService.assignSite(param(req, 'id'), param(req, 'siteId'), req.user.id);
    sendSuccess(res, null, 200, 'Valet assigned to site');
  }),

  unassignSite: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    await valetService.unassignSite(param(req, 'id'), param(req, 'siteId'), req.user.id);
    sendSuccess(res, null, 200, 'Valet removed from site');
  }),

  mySites: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const valet = await valetService.getById(req.user.id);
    sendSuccess(res, valet.valetAssignments.map((a) => a.site));
  }),
};
