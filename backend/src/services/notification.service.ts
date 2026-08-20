import type { Notification, NotificationType, Prisma, Role } from '@prisma/client';
import { prisma } from '../config/prisma';
import { getIO } from '../sockets/socket';

/**
 * Channel abstraction — implement this interface to add WhatsApp, SMS,
 * Firebase push, Twilio, etc. without touching business logic.
 */
export interface NotificationChannel {
  readonly name: string;
  send(notification: Notification): Promise<void>;
}

class SocketChannel implements NotificationChannel {
  readonly name = 'socket';

  async send(notification: Notification): Promise<void> {
    getIO()?.to(`user:${notification.userId}`).emit('notification', notification);
  }
}

const channels: NotificationChannel[] = [new SocketChannel()];

/** Register additional delivery channels (WhatsApp, SMS, push...) at boot time. */
export function registerNotificationChannel(channel: NotificationChannel): void {
  channels.push(channel);
}

interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Prisma.InputJsonValue;
}

export const notificationService = {
  async notifyUser(input: NotifyInput): Promise<Notification> {
    const notification = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        data: input.data,
      },
    });

    await Promise.allSettled(channels.map((channel) => channel.send(notification)));
    return notification;
  },

  async notifyUsers(userIds: string[], input: Omit<NotifyInput, 'userId'>): Promise<void> {
    await Promise.allSettled(userIds.map((userId) => this.notifyUser({ ...input, userId })));
  },

  async notifyRole(role: Role, input: Omit<NotifyInput, 'userId'>): Promise<void> {
    const users = await prisma.user.findMany({
      where: { role, isActive: true },
      select: { id: true },
    });
    await this.notifyUsers(
      users.map((u) => u.id),
      input,
    );
  },

  /** Notify every active valet assigned to a site (parked vehicles and pickup events). */
  async notifySiteValets(siteId: string, input: Omit<NotifyInput, 'userId'>): Promise<void> {
    const assignments = await prisma.valetSiteAssignment.findMany({
      where: { siteId, valet: { isActive: true, role: 'VALET' } },
      select: { valetId: true },
    });
    const valetIds = [...new Set(assignments.map((a) => a.valetId))];
    await this.notifyUsers(valetIds, input);
    getIO()?.to(`site:${siteId}`).emit('site:event', { siteId, ...input });
  },
};
