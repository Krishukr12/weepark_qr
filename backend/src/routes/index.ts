import { Router } from 'express';
import { authRoutes } from './auth.routes';
import { siteRoutes } from './site.routes';
import { valetRoutes } from './valet.routes';
import { organizationRoutes } from './organization.routes';
import { employeeRoutes } from './employee.routes';
import { vehicleRoutes } from './vehicle.routes';
import { parkingRoutes, publicParkingRoutes } from './parking.routes';
import { pickupRoutes, publicPickupRoutes } from './pickup.routes';
import { notificationRoutes } from './notification.routes';
import { dashboardRoutes } from './dashboard.routes';
import { auditRoutes } from './audit.routes';
import { organizationController } from '../controllers/organization.controller';

export const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/sites', siteRoutes);
apiRouter.use('/valets', valetRoutes);
apiRouter.use('/organizations', organizationRoutes);
apiRouter.use('/employees', employeeRoutes);
apiRouter.use('/vehicles', vehicleRoutes);
apiRouter.use('/parking', parkingRoutes);
apiRouter.use('/pickups', pickupRoutes);
apiRouter.use('/notifications', notificationRoutes);
apiRouter.use('/dashboard', dashboardRoutes);
apiRouter.use('/audit-logs', auditRoutes);

/** Public routes powering the physical QR flow — deliberately unauthenticated. */
export const publicRouter = Router();

publicRouter.use('/parking', publicParkingRoutes);
publicRouter.use('/pickups', publicPickupRoutes);
publicRouter.get('/organizations', organizationController.listPublic);
