import { Router } from 'express';
import { siteController } from '../controllers/site.controller';
import { authenticate } from '../middlewares/auth';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/validate';
import { createSiteSchema, updateSiteSchema } from '../validators/site.validator';

export const siteRoutes = Router();

siteRoutes.use(authenticate);

siteRoutes.get('/', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'VALET'), siteController.list);
siteRoutes.get('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'VALET'), siteController.getById);
siteRoutes.get('/:id/qr', authorize('SUPER_ADMIN'), siteController.downloadQr);
siteRoutes.post('/', authorize('SUPER_ADMIN'), validate({ body: createSiteSchema }), siteController.create);
siteRoutes.patch('/:id', authorize('SUPER_ADMIN'), validate({ body: updateSiteSchema }), siteController.update);
siteRoutes.delete('/:id', authorize('SUPER_ADMIN'), siteController.remove);
