import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { authenticate } from '../middlewares/auth';
import { authorize } from '../middlewares/authorize';
import { asyncHandler } from '../utils/asyncHandler';
import { buildPaginatedResult, getPagination, toSkipTake } from '../utils/pagination';
import { sendPaginated } from '../utils/response';
import type { Prisma } from '@prisma/client';

export const auditRoutes = Router();

auditRoutes.use(authenticate, authorize('SUPER_ADMIN'));

auditRoutes.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const params = getPagination(req);
    const where: Prisma.AuditLogWhereInput = params.search
      ? {
          OR: [
            { action: { contains: params.search, mode: 'insensitive' } },
            { entity: { contains: params.search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [items, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(params),
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    sendPaginated(res, buildPaginatedResult(items, total, params));
  }),
);
