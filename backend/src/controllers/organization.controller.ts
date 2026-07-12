import type { Request, Response } from 'express';
import { organizationService } from '../services/organization.service';
import { asyncHandler } from '../utils/asyncHandler';
import { param } from '../utils/request';
import { getPagination } from '../utils/pagination';
import { sendPaginated, sendSuccess } from '../utils/response';
import { ApiError } from '../utils/apiError';
import type { CreateOrganizationInput, UpdateOrganizationInput } from '../validators/organization.validator';

export const organizationController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await organizationService.list(getPagination(req));
    sendPaginated(res, result);
  }),

  /** Public list for the QR quick-registration organization dropdown. */
  listPublic: asyncHandler(async (_req: Request, res: Response) => {
    const orgs = await organizationService.listActive();
    sendSuccess(res, orgs);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    // Org admins can only fetch their own organization.
    if (req.user.role === 'ORG_ADMIN' && req.user.organizationId !== param(req, 'id')) {
      throw ApiError.forbidden('You can only access your own organization');
    }
    const org = await organizationService.getById(param(req, 'id'));
    sendSuccess(res, org);
  }),

  getMine: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.organizationId) throw ApiError.notFound('No organization linked to your account');
    const org = await organizationService.getById(req.user.organizationId);
    sendSuccess(res, org);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const org = await organizationService.create(req.body as CreateOrganizationInput, req.user.id);
    sendSuccess(res, org, 201, 'Organization onboarded — credentials emailed to admin');
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    if (req.user.role === 'ORG_ADMIN' && req.user.organizationId !== param(req, 'id')) {
      throw ApiError.forbidden('You can only update your own organization');
    }
    const org = await organizationService.update(param(req, 'id'), req.body as UpdateOrganizationInput, req.user.id);
    sendSuccess(res, org, 200, 'Organization updated successfully');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    await organizationService.remove(param(req, 'id'), req.user.id);
    sendSuccess(res, null, 200, 'Organization deleted successfully');
  }),
};
