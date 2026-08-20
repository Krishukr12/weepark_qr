import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { subscribeToNotifications, subscribeToSocketReconnect } from '@/lib/socket';
import { announceStaffNotification, resumeNotificationAudio } from '@/lib/notification-sound';
import { getNotificationHref } from '@/lib/notification-target';
import { realtimeInvalidationKeys } from '@/lib/realtime-invalidation';
import { notificationsApi } from '@/api/domain.api';
import type { AppNotification } from '@/types';

function pickupRequestIdOf(notification: AppNotification): string | null {
  const value = notification.data?.pickupRequestId;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Subscribes to real-time notifications for the signed-in user:
 * chime + toast (OS banner when the tab is in the background), then invalidate affected queries.
 * Pickup requests keep a looping alarm until a valet accepts.
 * Only mounted from AppShell — public QR customers never hear this.
 */
export function useRealtime(): void {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    const resume = () => resumeNotificationAudio();
    window.addEventListener('pointerdown', resume);
    window.addEventListener('keydown', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('keydown', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, []);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const href = (event as CustomEvent<string>).detail;
      if (href) navigate(href);
    };
    window.addEventListener('weepark:notification-open', onOpen);
    return () => window.removeEventListener('weepark:notification-open', onOpen);
  }, [navigate]);

  useEffect(() => {
    const onNotification = (notification: AppNotification) => {
      const href = getNotificationHref(notification);
      announceStaffNotification({
        title: notification.title,
        message: notification.message,
        href,
        type: notification.type,
        pickupRequestId: pickupRequestIdOf(notification),
      });
      toast(notification.title, {
        description: notification.message,
        duration: notification.type === 'PICKUP_REQUESTED' ? 12_000 : 7000,
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
      for (const queryKey of realtimeInvalidationKeys(notification.type)) {
        void queryClient.invalidateQueries({ queryKey });
      }
    };

    return subscribeToNotifications(onNotification);
  }, [navigate, queryClient]);

  useEffect(() => {
    return subscribeToSocketReconnect(() => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['pickups'] });
    });
  }, [queryClient]);
}
