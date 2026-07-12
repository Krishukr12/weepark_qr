import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { env } from '../config/env';
import { verifyAccessToken } from '../utils/token';
import type { AuthTokenPayload } from '../types';

let io: Server | null = null;

/**
 * Socket rooms:
 *  - `user:{userId}`  → direct notifications for a single user
 *  - `site:{siteId}`  → all valets watching a site (joined on connect based on assignments)
 *  - `role:{role}`    → broadcast to a role (e.g. all super admins)
 */
export function initSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: { origin: env.CLIENT_URL, credentials: true },
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
      if (typeof siteId === 'string' && siteId.length > 0) {
        void socket.join(`site:${siteId}`);
      }
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
