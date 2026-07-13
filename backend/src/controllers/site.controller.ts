import type { Request, Response } from 'express';
import { siteService } from '../services/site.service';
import { asyncHandler } from '../utils/asyncHandler';
import { param } from '../utils/request';
import { getPagination } from '../utils/pagination';
import { sendPaginated, sendSuccess } from '../utils/response';
import { ApiError } from '../utils/apiError';
import type { CreateSiteInput, UpdateSiteInput } from '../validators/site.validator';

export const siteController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const params = getPagination(req);
    const isActive =
      req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
    const result = await siteService.list(req.user, { ...params, isActive });
    sendPaginated(res, result);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const site = await siteService.getById(req.user, param(req, 'id'));
    sendSuccess(res, site);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const site = await siteService.create(req.body as CreateSiteInput, req.user.id);
    sendSuccess(res, site, 201, 'Site created successfully');
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const site = await siteService.update(param(req, 'id'), req.body as UpdateSiteInput, req.user.id);
    sendSuccess(res, site, 200, 'Site updated successfully');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    await siteService.remove(param(req, 'id'), req.user.id);
    sendSuccess(res, null, 200, 'Site deleted successfully');
  }),

  downloadQr: asyncHandler(async (req: Request, res: Response) => {
    const { buffer, siteCode } = await siteService.getQrPng(param(req, 'id'));
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="weepark-${siteCode}.png"`);
    res.send(buffer);
  }),
};
