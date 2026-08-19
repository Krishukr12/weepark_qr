import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Bell, CheckCheck } from 'lucide-react';
import { notificationsApi } from '@/api/domain.api';
import { getNotificationHref } from '@/lib/notification-target';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import type { AppNotification } from '@/types';

export function NotificationsPopover() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: unread } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: notificationsApi.unreadCount,
    refetchInterval: 60_000,
  });

  const { data: recent, isLoading } = useQuery({
    queryKey: ['notifications', 'recent', 'unread'],
    queryFn: () => notificationsApi.list({ page: 1, limit: 8, unreadOnly: true }),
  });

  const markAllRead = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markRead = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const openNotification = (notification: AppNotification) => {
    if (!notification.isRead) markRead.mutate(notification.id);
    const href = getNotificationHref(notification);
    setOpen(false);
    navigate(href ?? '/notifications');
  };

  const count = unread?.count ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-4.5" />
          {count > 0 ? (
            <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-brand text-[10px] font-semibold text-white dark:text-zinc-950">
              {count > 9 ? '9+' : count}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => markAllRead.mutate()}
            disabled={count === 0 || markAllRead.isPending}
          >
            <CheckCheck className="size-3.5" />
            Mark all read
          </Button>
        </div>
        <div className="max-h-96 overflow-y-auto scrollbar-thin">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : recent && recent.data.length > 0 ? (
            recent.data.map((notification) => (
              <button
                type="button"
                key={notification.id}
                onClick={() => openNotification(notification)}
                className="block w-full border-b bg-brand/5 px-4 py-3 text-left text-sm transition-colors last:border-0 hover:bg-muted/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{notification.title}</p>
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" />
                </div>
                <p className="mt-0.5 line-clamp-2 text-muted-foreground">{notification.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                </p>
              </button>
            ))
          ) : (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">You're all caught up.</p>
          )}
        </div>
        <div className="border-t p-2">
          <Button
            variant="ghost"
            className="w-full text-sm"
            onClick={() => {
              setOpen(false);
              navigate('/notifications');
            }}
          >
            View all notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
