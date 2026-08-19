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
    const clientType =
      req.query.clientType === 'B2B' || req.query.clientType === 'B2C' ? req.query.clientType : undefined;
    const result = await organizationService.list({ ...getPagination(req), clientType });
    sendPaginated(res, result);
  }),

  /** Remaining capacity per site — used when assigning allocations to an org. */
  siteCapacity: asyncHandler(async (req: Request, res: Response) => {
    const excludeOrganizationId =
      typeof req.query.excludeOrganizationId === 'string' ? req.query.excludeOrganizationId : undefined;
    const summaries = await organizationService.getSiteCapacitySummaries(excludeOrganizationId);
    sendSuccess(res, summaries);
  }),

  /** Public list for the QR quick-registration organization dropdown. */
  listPublic: asyncHandler(async (req: Request, res: Response) => {
    const siteCode = typeof req.query.siteCode === 'string' ? req.query.siteCode : undefined;
    if (!siteCode) {
      throw ApiError.badRequest('siteCode is required');
    }
    const orgs = await organizationService.listActiveForSite(siteCode);
    sendSuccess(res, orgs);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
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
    const body = req.body as UpdateOrganizationInput;
    const input: UpdateOrganizationInput =
      req.user.role === 'ORG_ADMIN'
        ? { ...body, siteAllocations: undefined, isActive: undefined }
        : body;
    const org = await organizationService.update(param(req, 'id'), input, req.user.id);
    sendSuccess(res, org, 200, 'Organization updated successfully');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    await organizationService.remove(param(req, 'id'), req.user.id);
    sendSuccess(res, null, 200, 'Organization deleted successfully');
  }),

  assignSite: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const allocatedSpaces = Number((req.body as { allocatedSpaces?: number }).allocatedSpaces);
    if (!Number.isInteger(allocatedSpaces) || allocatedSpaces < 1) {
      throw ApiError.badRequest('allocatedSpaces must be a positive integer');
    }
    const org = await organizationService.assignSite(
      param(req, 'id'),
      param(req, 'siteId'),
      allocatedSpaces,
      req.user.id,
    );
    sendSuccess(res, org, 200, 'Site assigned to organization');
  }),

  unassignSite: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const org = await organizationService.unassignSite(param(req, 'id'), param(req, 'siteId'), req.user.id);
    sendSuccess(res, org, 200, 'Site unassigned from organization');
  }),
};
