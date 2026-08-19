import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { userRepository } from '../repositories/user.repository';
import { ApiError } from '../utils/apiError';
import { hashPassword, verifyPassword } from '../utils/password';
import {
  generateRandomToken,
  hashToken,
  parseDurationToMs,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/token';
import { revokeAllRefreshTokens } from '../utils/sessions';
import { emailService } from './email.service';
import { recordAudit } from './audit.service';
import type { AuthenticatedUser, AuthTokenPayload } from '../types';
import type { OrganizationClientType, User } from '@prisma/client';

interface LoginContext {
  userAgent?: string;
  ipAddress?: string;
}

interface AuthResult {
  user: AuthenticatedUser & { photoUrl: string | null; phone: string | null };
  accessToken: string;
  refreshToken: string;
}

function toPayload(user: User): AuthTokenPayload {
  return { sub: user.id, role: user.role, organizationId: user.organizationId };
}

async function organizationClientTypeFor(organizationId: string | null): Promise<OrganizationClientType | null> {
  if (!organizationId) return null;
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { clientType: true },
  });
  return org?.clientType ?? null;
}

async function toAuthUser(user: User): Promise<AuthResult['user']> {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    organizationClientType: await organizationClientTypeFor(user.organizationId),
    isActive: user.isActive,
    photoUrl: user.photoUrl,
    phone: user.phone,
  };
}

async function persistRefreshToken(user: User, refreshToken: string, context: LoginContext): Promise<void> {
  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshToken),
      userId: user.id,
      userAgent: context.userAgent ?? null,
      ipAddress: context.ipAddress ?? null,
      expiresAt: new Date(Date.now() + parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN)),
    },
  });
}

async function issueTokens(user: User, context: LoginContext): Promise<Omit<AuthResult, 'user'>> {
  const payload = toPayload(user);
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  await persistRefreshToken(user, refreshToken, context);
  return { accessToken, refreshToken };
}

export const authService = {
  async login(email: string, password: string, context: LoginContext): Promise<AuthResult> {
    const user = await userRepository.findByEmail(email);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      await recordAudit({
        action: 'LOGIN_FAILED',
        entity: 'User',
        metadata: { email: email.toLowerCase() },
        ipAddress: context.ipAddress,
      });
      throw ApiError.unauthorized('Invalid email or password');
    }
    if (!user.isActive) {
      throw ApiError.forbidden('Your account has been deactivated. Contact your administrator.');
    }

    const tokens = await issueTokens(user, context);
    await recordAudit({
      userId: user.id,
      action: 'LOGIN',
      entity: 'User',
      entityId: user.id,
      ipAddress: context.ipAddress,
    });
    return { user: await toAuthUser(user), ...tokens };
  },

  async refresh(refreshToken: string, context: LoginContext): Promise<AuthResult> {
    let payload: AuthTokenPayload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw ApiError.unauthorized('Invalid or expired refresh token');
    }

    const tokenHash = hashToken(refreshToken);

    const tokens = await prisma.$transaction(async (tx) => {
      const stored = await tx.refreshToken.findUnique({ where: { tokenHash } });
      if (!stored) return { kind: 'missing' as const };

      if (stored.revokedAt) {
        await tx.refreshToken.updateMany({
          where: { userId: stored.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return { kind: 'reuse' as const };
      }

      if (stored.expiresAt < new Date()) {
        return { kind: 'expired' as const };
      }

      const claimed = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (claimed.count === 0) return { kind: 'missing' as const };

      const user = await tx.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.isActive) {
        return { kind: 'inactive' as const };
      }

      const nextPayload = toPayload(user);
      const accessToken = signAccessToken(nextPayload);
      const nextRefresh = signRefreshToken(nextPayload);
      await tx.refreshToken.create({
        data: {
          tokenHash: hashToken(nextRefresh),
          userId: user.id,
          userAgent: context.userAgent ?? null,
          ipAddress: context.ipAddress ?? null,
          expiresAt: new Date(Date.now() + parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN)),
        },
      });

      return { kind: 'ok' as const, user, accessToken, refreshToken: nextRefresh };
    });

    if (tokens.kind === 'reuse') {
      throw ApiError.unauthorized('Refresh token reuse detected. Please sign in again.');
    }
    if (tokens.kind !== 'ok') {
      throw ApiError.unauthorized(
        tokens.kind === 'inactive'
          ? 'Account is inactive or no longer exists'
          : 'Refresh token has been revoked or expired',
      );
    }

    return { user: await toAuthUser(tokens.user), accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  },

  async logout(refreshToken: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  async forgotPassword(email: string): Promise<void> {
    const user = await userRepository.findByEmail(email);
    if (!user || !user.isActive) return;

    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });

    const token = generateRandomToken();
    await prisma.passwordResetToken.create({
      data: {
        tokenHash: hashToken(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    try {
      await emailService.sendPasswordResetRequest({ to: user.email, name: user.name, token });
    } catch {
      // Do not leak whether the account exists if delivery fails.
    }
  },

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const stored = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });

    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      throw ApiError.badRequest('This reset link is invalid or has expired');
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.$transaction([
      prisma.user.update({ where: { id: stored.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: stored.id }, data: { usedAt: new Date() } }),
      prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await emailService.sendPasswordResetSuccess({ to: stored.user.email, name: stored.user.name });
    await recordAudit({ userId: stored.userId, action: 'PASSWORD_RESET', entity: 'User', entityId: stored.userId });
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await userRepository.findById(userId);
    if (!user) throw ApiError.notFound('User not found');

    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw ApiError.badRequest('Current password is incorrect');
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword) } }),
      prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await recordAudit({ userId, action: 'PASSWORD_CHANGE', entity: 'User', entityId: userId });
  },

  async getSessions(userId: string): Promise<{ id: string; userAgent: string | null; ipAddress: string | null; createdAt: Date; expiresAt: Date }[]> {
    return prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, userAgent: true, ipAddress: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  revokeAllRefreshTokens,
};
