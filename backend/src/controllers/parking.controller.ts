import type { Request, Response } from 'express';
import { format } from 'date-fns';
import { parkingService } from '../services/parking.service';
import { siteService } from '../services/site.service';
import { reportService } from '../services/report.service';
import { asyncHandler } from '../utils/asyncHandler';
import { param } from '../utils/request';
import { getPagination } from '../utils/pagination';
import { sendPaginated, sendSuccess } from '../utils/response';
import { ApiError } from '../utils/apiError';
import {
  PARKING_SORT_FIELDS,
  parkingHistoryFilterSchema,
  type QuickRegisterInput,
} from '../validators/parking.validator';

export const parkingController = {
  history: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const filter = parkingHistoryFilterSchema.parse(req.query);
    const result = await parkingService.history(req.user, getPagination(req, PARKING_SORT_FIELDS), filter);
    sendPaginated(res, result);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const entry = await parkingService.getById(req.user, param(req, 'id'));
    sendSuccess(res, entry);
  }),

  exportCsv: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const filter = parkingHistoryFilterSchema.parse(req.query);
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const entries = await parkingService.exportHistory(req.user, filter, search);
    const csv = reportService.toCsv(entries);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="weepark-history-${format(new Date(), 'yyyyMMdd-HHmm')}.csv"`);
    res.send(csv);
  }),

  exportExcel: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const filter = parkingHistoryFilterSchema.parse(req.query);
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const entries = await parkingService.exportHistory(req.user, filter, search);
    const buffer = await reportService.toExcel(entries);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="weepark-history-${format(new Date(), 'yyyyMMdd-HHmm')}.xlsx"`);
    res.send(buffer);
  }),

  getPublicSite: asyncHandler(async (req: Request, res: Response) => {
    const site = await siteService.getPublicByCode(param(req, 'siteCode'));
    sendSuccess(res, site);
  }),

  lookupVehicle: asyncHandler(async (req: Request, res: Response) => {
    const { vehicleNumber } = req.body as { vehicleNumber: string };
    const result = await parkingService.lookupVehicle(param(req, 'siteCode'), vehicleNumber);
    sendSuccess(res, result);
  }),

  quickRegister: asyncHandler(async (req: Request, res: Response) => {
    const result = await parkingService.quickRegister(param(req, 'siteCode'), req.body as QuickRegisterInput);
    sendSuccess(res, result, 201, 'Vehicle registered');
  }),

  parkVehicle: asyncHandler(async (req: Request, res: Response) => {
    const { parkToken, notes } = req.body as { parkToken: string; notes?: string };
    const result = await parkingService.parkVehicle(param(req, 'siteCode'), parkToken, notes);
    sendSuccess(res, result, 201, 'Vehicle parked successfully');
  }),

  getParkingSession: asyncHandler(async (req: Request, res: Response) => {
    const { sessionToken } = req.body as { sessionToken: string };
    const parking = await parkingService.getPublicSession(sessionToken);
    sendSuccess(res, parking);
  }),
};
