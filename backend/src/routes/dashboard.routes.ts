import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';
import { authenticate } from '../middlewares/auth';

export const dashboardRoutes = Router();

dashboardRoutes.use(authenticate);

dashboardRoutes.get('/stats', dashboardController.stats);
dashboardRoutes.get('/parking-trend', dashboardController.parkingTrend);
dashboardRoutes.get('/peak-hours', dashboardController.peakHours);
dashboardRoutes.get('/organization-usage', dashboardController.organizationUsage);
dashboardRoutes.get('/site-usage', dashboardController.siteUsage);
