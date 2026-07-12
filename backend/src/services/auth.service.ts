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
import { emailService } from './email.service';
import { recordAudit } from './audit.service';
import type { AuthenticatedUser, AuthTokenPayload } from '../types';
import type { User } from '@prisma/client';

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
  return { sub: user.id, role: user.role, organizationId: user.organizationId, email: user.email };
}

function toAuthUser(user: User): AuthResult['user'] {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    isActive: user.isActive,
    photoUrl: user.photoUrl,
    phone: user.phone,
  };
}

async function issueTokens(user: User, context: LoginContext): Promise<Omit<AuthResult, 'user'>> {
  const payload = toPayload(user);
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshToken),
      userId: user.id,
      userAgent: context.userAgent ?? null,
      ipAddress: context.ipAddress ?? null,
      expiresAt: new Date(Date.now() + parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN)),
    },
  });

  return { accessToken, refreshToken };
}

export const authService = {
  async login(email: string, password: string, context: LoginContext): Promise<AuthResult> {
    const user = await userRepository.findByEmail(email);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw ApiError.unauthorized('Invalid email or password');
    }
    if (!user.isActive) {
      throw ApiError.forbidden('Your account has been deactivated. Contact your administrator.');
    }

    const tokens = await issueTokens(user, context);
    await recordAudit({ userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id, ipAddress: context.ipAddress });
    return { user: toAuthUser(user), ...tokens };
  },

  async refresh(refreshToken: string, context: LoginContext): Promise<AuthResult> {
    let payload: AuthTokenPayload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw ApiError.unauthorized('Invalid or expired refresh token');
    }

    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(refreshToken) } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw ApiError.unauthorized('Refresh token has been revoked or expired');
    }

    const user = await userRepository.findById(payload.sub);
    if (!user || !user.isActive) {
      throw ApiError.unauthorized('Account is inactive or no longer exists');
    }

    // Rotate: revoke the old token, issue a fresh pair.
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    const tokens = await issueTokens(user, context);
    return { user: toAuthUser(user), ...tokens };
  },

  async logout(refreshToken: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  async forgotPassword(email: string): Promise<void> {
    const user = await userRepository.findByEmail(email);
    // Always succeed silently so the endpoint can't be used to enumerate accounts.
    if (!user || !user.isActive) return;

    const token = generateRandomToken();
    await prisma.passwordResetToken.create({
      data: {
        tokenHash: hashToken(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    await emailService.sendPasswordResetRequest({ to: user.email, name: user.name, token });
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
      // Revoke all sessions after a password reset.
      prisma.refreshToken.updateMany({ where: { userId: stored.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
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

    await userRepository.update(userId, { passwordHash: await hashPassword(newPassword) });
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
};
