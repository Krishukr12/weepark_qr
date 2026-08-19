import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { env, isTest } from '../config/env';
import { prisma } from '../config/prisma';
import { organizationRepository } from '../repositories/organization.repository';
import { verifyAccessToken } from '../utils/token';
import type { AuthTokenPayload } from '../types';

let io: Server | null = null;

export async function canJoinSite(user: AuthTokenPayload, siteId: string): Promise<boolean> {
  if (typeof siteId !== 'string' || siteId.length < 20) return false;
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true } });
  if (!site) return false;

  if (user.role === 'SUPER_ADMIN') return true;
  if (user.role === 'ORG_ADMIN') {
    if (!user.organizationId) return false;
    return organizationRepository.isAssignedToSite(user.organizationId, siteId);
  }
  if (user.role === 'VALET') {
    const assignment = await prisma.valetSiteAssignment.findUnique({
      where: { valetId_siteId: { valetId: user.sub, siteId } },
    });
    return Boolean(assignment);
  }
  return false;
}

export function initSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: { origin: isTest ? true : env.CLIENT_URL, credentials: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      next(new Error('Authentication required'));
      return;
    }
    try {
      const payload = verifyAccessToken(token);
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user as AuthTokenPayload;
    void socket.join(`user:${user.sub}`);
    void socket.join(`role:${user.role}`);

    socket.on('join:site', (siteId: string) => {
      void (async () => {
        if (await canJoinSite(user, siteId)) {
          await socket.join(`site:${siteId}`);
          return;
        }
        socket.emit('join:site:denied', { siteId });
      })();
    });

    socket.on('leave:site', (siteId: string) => {
      if (typeof siteId === 'string') {
        void socket.leave(`site:${siteId}`);
      }
    });
  });

  return io;
}

export function getIO(): Server | null {
  return io;
}

export async function closeSocket(): Promise<void> {
  if (!io) return;
  await new Promise<void>((resolve) => {
    void io?.close(() => resolve());
  });
  io = null;
}
