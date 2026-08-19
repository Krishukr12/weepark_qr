import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';
import { authenticate } from '../middlewares/auth';
import { authorize } from '../middlewares/authorize';

export const dashboardRoutes = Router();

dashboardRoutes.use(authenticate, authorize('SUPER_ADMIN', 'ORG_ADMIN', 'VALET'));

dashboardRoutes.get('/stats', dashboardController.stats);
dashboardRoutes.get('/parking-trend', dashboardController.parkingTrend);
dashboardRoutes.get('/peak-hours', dashboardController.peakHours);
dashboardRoutes.get('/organization-usage', dashboardController.organizationUsage);
dashboardRoutes.get('/site-usage', dashboardController.siteUsage);
