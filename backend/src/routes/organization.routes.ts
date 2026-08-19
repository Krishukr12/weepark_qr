import { Router } from 'express';
import { organizationController } from '../controllers/organization.controller';
import { authenticate } from '../middlewares/auth';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/validate';
import {
  assignOrgSiteSchema,
  createOrganizationSchema,
  updateOrganizationSchema,
} from '../validators/organization.validator';
import { idParamsSchema } from '../validators/parking.validator';
import { z } from 'zod';
import { cuidId } from '../validators/common';

const orgSiteParams = z.object({ id: cuidId, siteId: cuidId });

export const organizationRoutes = Router();

organizationRoutes.use(authenticate);

organizationRoutes.get('/mine', authorize('ORG_ADMIN'), organizationController.getMine);
organizationRoutes.get('/site-capacity', authorize('SUPER_ADMIN'), organizationController.siteCapacity);
organizationRoutes.get('/', authorize('SUPER_ADMIN'), organizationController.list);
organizationRoutes.get('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN'), validate({ params: idParamsSchema }), organizationController.getById);
organizationRoutes.post('/', authorize('SUPER_ADMIN'), validate({ body: createOrganizationSchema }), organizationController.create);
organizationRoutes.patch('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN'), validate({ params: idParamsSchema, body: updateOrganizationSchema }), organizationController.update);
organizationRoutes.delete('/:id', authorize('SUPER_ADMIN'), validate({ params: idParamsSchema }), organizationController.remove);
organizationRoutes.post(
  '/:id/sites/:siteId',
  authorize('SUPER_ADMIN'),
  validate({ params: orgSiteParams, body: assignOrgSiteSchema }),
  organizationController.assignSite,
);
organizationRoutes.delete('/:id/sites/:siteId', authorize('SUPER_ADMIN'), validate({ params: orgSiteParams }), organizationController.unassignSite);
