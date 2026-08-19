import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getSocket } from '@/lib/socket';
import { playNotificationChime, unlockNotificationAudio } from '@/lib/notification-sound';
import { getNotificationHref } from '@/lib/notification-target';
import { notificationsApi } from '@/api/domain.api';
import type { AppNotification } from '@/types';

/**
 * Subscribes to real-time notifications for the signed-in user:
 * chime + toast, then invalidate affected queries so views stay live.
 * Only mounted from AppShell — public QR customers never hear this.
 */
export function useRealtime(): void {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    const unlock = () => unlockNotificationAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onNotification = (notification: AppNotification) => {
      playNotificationChime();
      const href = getNotificationHref(notification);
      toast(notification.title, {
        description: notification.message,
        duration: 7000,
        action: href
          ? {
              label: 'Open',
              onClick: () => {
                if (!notification.isRead) {
                  void notificationsApi.markRead(notification.id).then(() => {
                    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
                  });
                }
                navigate(href);
              },
            }
          : undefined,
      });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });

      if (notification.type.startsWith('PICKUP')) {
        void queryClient.invalidateQueries({ queryKey: ['pickups'] });
        void queryClient.invalidateQueries({ queryKey: ['parking'] });
      }
      if (notification.type === 'VEHICLE_PARKED') {
        void queryClient.invalidateQueries({ queryKey: ['parking'] });
        void queryClient.invalidateQueries({ queryKey: ['sites'] });
      }
      if (notification.type === 'ORGANIZATION_CREATED') {
        void queryClient.invalidateQueries({ queryKey: ['organizations'] });
      }
      if (notification.type === 'VALET_ASSIGNED' || notification.type === 'VALET_UNASSIGNED') {
        void queryClient.invalidateQueries({ queryKey: ['sites'] });
        void queryClient.invalidateQueries({ queryKey: ['valets'] });
      }
    };

    socket.on('notification', onNotification);
    return () => {
      socket.off('notification', onNotification);
    };
  }, [navigate, queryClient]);
}
