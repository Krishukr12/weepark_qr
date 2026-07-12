import { Router } from 'express';
import { organizationController } from '../controllers/organization.controller';
import { authenticate } from '../middlewares/auth';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/validate';
import { createOrganizationSchema, updateOrganizationSchema } from '../validators/organization.validator';

export const organizationRoutes = Router();

organizationRoutes.use(authenticate);

organizationRoutes.get('/mine', authorize('ORG_ADMIN'), organizationController.getMine);
organizationRoutes.get('/', authorize('SUPER_ADMIN'), organizationController.list);
organizationRoutes.get('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN'), organizationController.getById);
organizationRoutes.post('/', authorize('SUPER_ADMIN'), validate({ body: createOrganizationSchema }), organizationController.create);
organizationRoutes.patch('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN'), validate({ body: updateOrganizationSchema }), organizationController.update);
organizationRoutes.delete('/:id', authorize('SUPER_ADMIN'), organizationController.remove);
