import { Router } from 'express';
import { vehicleController } from '../controllers/vehicle.controller';
import { authenticate } from '../middlewares/auth';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/validate';
import { createVehicleSchema, updateVehicleSchema } from '../validators/vehicle.validator';

export const vehicleRoutes = Router();

vehicleRoutes.use(authenticate, authorize('SUPER_ADMIN', 'ORG_ADMIN'));

vehicleRoutes.get('/', vehicleController.list);
vehicleRoutes.get('/:id', vehicleController.getById);
vehicleRoutes.post('/', validate({ body: createVehicleSchema }), vehicleController.create);
vehicleRoutes.patch('/:id', validate({ body: updateVehicleSchema }), vehicleController.update);
vehicleRoutes.delete('/:id', vehicleController.remove);
