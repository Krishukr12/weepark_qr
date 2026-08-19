import { Router } from 'express';
import { pickupController } from '../controllers/pickup.controller';
import { authenticate } from '../middlewares/auth';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/validate';
import { publicPickupLimiter } from '../middlewares/rateLimiter';
import { idParamsSchema, publicPickupSchema } from '../validators/parking.validator';

export const pickupRoutes = Router();

pickupRoutes.use(authenticate, authorize('SUPER_ADMIN', 'ORG_ADMIN', 'VALET'));

pickupRoutes.get('/', pickupController.list);
pickupRoutes.post('/:id/accept', authorize('VALET'), validate({ params: idParamsSchema }), pickupController.accept);
pickupRoutes.post(
  '/:id/complete',
  authorize('VALET', 'SUPER_ADMIN'),
  validate({ params: idParamsSchema }),
  pickupController.complete,
);

export const publicPickupRoutes = Router();

publicPickupRoutes.post(
  '/request',
  publicPickupLimiter,
  validate({ body: publicPickupSchema }),
  pickupController.request,
);
