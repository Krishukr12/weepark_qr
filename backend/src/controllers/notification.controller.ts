import type { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { asyncHandler } from '../utils/asyncHandler';
import { param } from '../utils/request';
import { getPagination, buildPaginatedResult, toSkipTake } from '../utils/pagination';
import { sendPaginated, sendSuccess } from '../utils/response';
import { ApiError } from '../utils/apiError';

export const notificationController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const params = getPagination(req);
    const unreadOnly = req.query.unreadOnly === 'true';

    const where = { userId: req.user.id, ...(unreadOnly ? { isRead: false } : {}) };
    const [items, total] = await prisma.$transaction([
      prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, ...toSkipTake(params) }),
      prisma.notification.count({ where }),
    ]);

    sendPaginated(res, buildPaginatedResult(items, total, params));
  }),

  unreadCount: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const count = await prisma.notification.count({ where: { userId: req.user.id, isRead: false } });
    sendSuccess(res, { count });
  }),

  markRead: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    await prisma.notification.updateMany({
      where: { id: param(req, 'id'), userId: req.user.id },
      data: { isRead: true },
    });
    sendSuccess(res, null, 200, 'Notification marked as read');
  }),

  markAllRead: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    });
    sendSuccess(res, null, 200, 'All notifications marked as read');
  }),
};
