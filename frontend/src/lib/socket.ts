import { io, type Socket } from 'socket.io-client';
import { tokenStore } from './token-store';
import { API_ORIGIN, refreshAccessToken } from './api';
import { isAccessTokenFresh } from './access-token';
import type { AppNotification } from '@/types';

type NotificationHandler = (notification: AppNotification) => void;

let socket: Socket | null = null;
const notificationHandlers = new Set<NotificationHandler>();
const reconnectHandlers = new Set<() => void>();

async function socketAuthToken(): Promise<string> {
  const current = tokenStore.getAccessToken();
  if (current && isAccessTokenFresh(current)) return current;
  return (await refreshAccessToken()) ?? current ?? '';
}

function attachSocketListeners(next: Socket): void {
  next.on('notification', (payload: AppNotification) => {
    for (const handler of notificationHandlers) handler(payload);
  });
  next.on('connect', () => {
    for (const handler of reconnectHandlers) handler();
  });
}

export function subscribeToNotifications(handler: NotificationHandler): () => void {
  notificationHandlers.add(handler);
  return () => {
    notificationHandlers.delete(handler);
  };
}

export function subscribeToSocketReconnect(handler: () => void): () => void {
  reconnectHandlers.add(handler);
  return () => {
    reconnectHandlers.delete(handler);
  };
}

export function connectSocket(): Socket | null {
  const token = tokenStore.getAccessToken();
  if (!token) return null;

  if (socket) {
    if (!socket.connected) socket.connect();
    return socket;
  }

  socket = io(API_ORIGIN || '/', {
    auth: (cb) => {
      void socketAuthToken().then((authToken) => cb({ token: authToken }));
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Number.POSITIVE_INFINITY,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
  });

  attachSocketListeners(socket);
  return socket;
}

export function disconnectSocket(): void {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}
