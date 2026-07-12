import { Router } from 'express';
import { parkingController } from '../controllers/parking.controller';
import { authenticate } from '../middlewares/auth';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/validate';
import { lookupVehicleSchema, parkVehicleSchema, quickRegisterSchema } from '../validators/parking.validator';

export const parkingRoutes = Router();

parkingRoutes.use(authenticate, authorize('SUPER_ADMIN', 'ORG_ADMIN', 'VALET'));

parkingRoutes.get('/', parkingController.history);
parkingRoutes.get('/export/csv', parkingController.exportCsv);
parkingRoutes.get('/export/excel', parkingController.exportExcel);
parkingRoutes.get('/:id', parkingController.getById);

/** Public QR-flow routes — no authentication, mounted separately. */
export const publicParkingRoutes = Router();

publicParkingRoutes.get('/sites/:siteCode', parkingController.getPublicSite);
publicParkingRoutes.post('/sites/:siteCode/lookup', validate({ body: lookupVehicleSchema }), parkingController.lookupVehicle);
publicParkingRoutes.post('/sites/:siteCode/register', validate({ body: quickRegisterSchema }), parkingController.quickRegister);
publicParkingRoutes.post('/sites/:siteCode/park', validate({ body: parkVehicleSchema }), parkingController.parkVehicle);
publicParkingRoutes.get('/entries/:id', parkingController.getParkingStatus);
