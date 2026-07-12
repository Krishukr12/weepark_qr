import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getSocket } from '@/lib/socket';
import type { AppNotification } from '@/types';

/**
 * Subscribes to real-time notifications for the signed-in user:
 * shows a toast and invalidates affected queries so views stay live.
 */
export function useRealtime(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onNotification = (notification: AppNotification) => {
      toast(notification.title, { description: notification.message });
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
    };

    socket.on('notification', onNotification);
    return () => {
      socket.off('notification', onNotification);
    };
  }, [queryClient]);
}
