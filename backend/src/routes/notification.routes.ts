import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';
import { authenticate } from '../middlewares/auth';

export const notificationRoutes = Router();

notificationRoutes.use(authenticate);

notificationRoutes.get('/', notificationController.list);
notificationRoutes.get('/unread-count', notificationController.unreadCount);
notificationRoutes.post('/:id/read', notificationController.markRead);
notificationRoutes.post('/read-all', notificationController.markAllRead);
