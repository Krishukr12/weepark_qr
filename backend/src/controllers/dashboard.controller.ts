import type { Request, Response } from 'express';
import { dashboardService } from '../services/dashboard.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { ApiError } from '../utils/apiError';

export const dashboardController = {
  stats: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const stats = await dashboardService.getStats(req.user);
    sendSuccess(res, stats);
  }),

  parkingTrend: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const days = Math.min(90, Math.max(7, Number(req.query.days) || 14));
    const trend = await dashboardService.getParkingTrend(req.user, days);
    sendSuccess(res, trend);
  }),

  peakHours: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const data = await dashboardService.getPeakHours(req.user);
    sendSuccess(res, data);
  }),

  organizationUsage: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const data = await dashboardService.getOrganizationUsage(req.user);
    sendSuccess(res, data);
  }),

  siteUsage: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const data = await dashboardService.getSiteUsage(req.user);
    sendSuccess(res, data);
  }),
};
