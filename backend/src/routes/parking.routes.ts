import { Router } from 'express';
import { parkingController } from '../controllers/parking.controller';
import { authenticate } from '../middlewares/auth';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/validate';
import {
  publicLookupLimiter,
  publicParkLimiter,
  publicRegisterLimiter,
} from '../middlewares/rateLimiter';
import {
  idParamsSchema,
  lookupVehicleSchema,
  parkVehicleSchema,
  parkingHistoryFilterSchema,
  parkingSessionSchema,
  quickRegisterSchema,
  siteCodeParamsSchema,
} from '../validators/parking.validator';

export const parkingRoutes = Router();

parkingRoutes.use(authenticate, authorize('SUPER_ADMIN', 'ORG_ADMIN', 'VALET'));

parkingRoutes.get('/', validate({ query: parkingHistoryFilterSchema }), parkingController.history);
parkingRoutes.get('/export/csv', validate({ query: parkingHistoryFilterSchema }), parkingController.exportCsv);
parkingRoutes.get('/export/excel', validate({ query: parkingHistoryFilterSchema }), parkingController.exportExcel);
parkingRoutes.get('/:id', validate({ params: idParamsSchema }), parkingController.getById);

export const publicParkingRoutes = Router();

publicParkingRoutes.get(
  '/sites/:siteCode',
  validate({ params: siteCodeParamsSchema }),
  parkingController.getPublicSite,
);
publicParkingRoutes.post(
  '/sites/:siteCode/lookup',
  publicLookupLimiter,
  validate({ params: siteCodeParamsSchema, body: lookupVehicleSchema }),
  parkingController.lookupVehicle,
);
publicParkingRoutes.post(
  '/sites/:siteCode/register',
  publicRegisterLimiter,
  validate({ params: siteCodeParamsSchema, body: quickRegisterSchema }),
  parkingController.quickRegister,
);
publicParkingRoutes.post(
  '/sites/:siteCode/park',
  publicParkLimiter,
  validate({ params: siteCodeParamsSchema, body: parkVehicleSchema }),
  parkingController.parkVehicle,
);
publicParkingRoutes.post(
  '/session/status',
  publicLookupLimiter,
  validate({ body: parkingSessionSchema }),
  parkingController.getParkingSession,
);
