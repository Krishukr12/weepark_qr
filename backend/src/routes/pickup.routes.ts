import { Router } from 'express';
import { z } from 'zod';
import { pickupController } from '../controllers/pickup.controller';
import { authenticate } from '../middlewares/auth';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/validate';

export const pickupRoutes = Router();

pickupRoutes.use(authenticate, authorize('SUPER_ADMIN', 'ORG_ADMIN', 'VALET'));

pickupRoutes.get('/', pickupController.list);
pickupRoutes.post('/:id/accept', authorize('VALET'), pickupController.accept);
pickupRoutes.post('/:id/complete', authorize('VALET', 'SUPER_ADMIN'), pickupController.complete);

/** Public — "GET MY CAR" from the QR page. */
export const publicPickupRoutes = Router();

publicPickupRoutes.post(
  '/request',
  validate({ body: z.object({ parkingEntryId: z.string().min(1, 'parkingEntryId is required') }) }),
  pickupController.request,
);
