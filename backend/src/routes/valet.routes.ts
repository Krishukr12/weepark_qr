import { Router } from 'express';
import { valetController } from '../controllers/valet.controller';
import { authenticate } from '../middlewares/auth';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/validate';
import { createValetSchema, updateValetSchema } from '../validators/valet.validator';

export const valetRoutes = Router();

valetRoutes.use(authenticate);

valetRoutes.get('/my-sites', authorize('VALET'), valetController.mySites);
valetRoutes.get('/', authorize('SUPER_ADMIN'), valetController.list);
valetRoutes.get('/:id', authorize('SUPER_ADMIN'), valetController.getById);
valetRoutes.post('/', authorize('SUPER_ADMIN'), validate({ body: createValetSchema }), valetController.create);
valetRoutes.patch('/:id', authorize('SUPER_ADMIN'), validate({ body: updateValetSchema }), valetController.update);
valetRoutes.delete('/:id', authorize('SUPER_ADMIN'), valetController.deactivate);
valetRoutes.post('/:id/sites/:siteId', authorize('SUPER_ADMIN'), valetController.assignSite);
valetRoutes.delete('/:id/sites/:siteId', authorize('SUPER_ADMIN'), valetController.unassignSite);
