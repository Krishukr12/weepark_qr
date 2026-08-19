import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/apiError';
import { asyncHandler } from '../utils/asyncHandler';
import { verifyAccessToken } from '../utils/token';

export const authenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Authentication token is missing');
  }

  const token = header.slice(7);
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      organizationId: true,
      isActive: true,
      organization: { select: { clientType: true } },
    },
  });

  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Account is inactive or no longer exists');
  }

  req.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    organizationClientType: user.organization?.clientType ?? null,
    isActive: user.isActive,
  };
  next();
});
