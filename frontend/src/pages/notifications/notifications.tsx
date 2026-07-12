import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Bell, BellRing, Building2, Car, CheckCheck, PackageCheck, UserCog } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { notificationsApi } from '@/api/domain.api';
import { useListState } from '@/hooks/use-list-state';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { AppNotification, NotificationType, PaginationMeta } from '@/types';

const typeIcons: Record<NotificationType, LucideIcon> = {
  VEHICLE_PARKED: Car,
  PICKUP_REQUESTED: BellRing,
  PICKUP_ACCEPTED: PackageCheck,
  PICKUP_COMPLETED: PackageCheck,
  ORGANIZATION_CREATED: Building2,
  VALET_ASSIGNED: UserCog,
  VALET_UNASSIGNED: UserCog,
  SYSTEM: Bell,
};

function NotificationRow({ notification }: { notification: AppNotification }) {
  const queryClient = useQueryClient();
  const Icon = typeIcons[notification.type] ?? Bell;

  const markRead = useMutation({
    mutationFn: () => notificationsApi.markRead(notification.id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return (
    <button
      type="button"
      onClick={() => !notification.isRead && markRead.mutate()}
      className={cn(
        'flex w-full items-start gap-3.5 border-b p-4 text-left transition-colors last:border-0 hover:bg-muted/50',
        !notification.isRead && 'bg-brand/5',
      )}
    >
      <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', notification.isRead ? 'bg-muted' : 'bg-brand/12')}>
        <Icon className={cn('size-4.5', notification.isRead ? 'text-muted-foreground' : 'text-brand')} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{notification.title}</p>
          {!notification.isRead ? <span className="size-2 shrink-0 rounded-full bg-brand" /> : null}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{notification.message}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
        </p>
      </div>
    </button>
  );
}

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const { setPage, params } = useListState(15);
  const [tab, setTab] = useState<'all' | 'unread'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'page', params, tab],
    queryFn: () => notificationsApi.list({ ...params, unreadOnly: tab === 'unread' }),
  });

  const markAllRead = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const meta: PaginationMeta | undefined = data?.meta;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Real-time activity across your parking operations."
        actions={
          <Button variant="outline" onClick={() => markAllRead.mutate()} loading={markAllRead.isPending}>
            <CheckCheck /> Mark all read
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(value) => { setTab(value as 'all' | 'unread'); setPage(1); }}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <Card className="divide-y p-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3.5 p-4">
              <Skeleton className="size-9 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-72" />
              </div>
            </div>
          ))}
        </Card>
      ) : data && data.data.length > 0 ? (
        <>
          <Card className="p-0">
            {data.data.map((notification) => (
              <NotificationRow key={notification.id} notification={notification} />
            ))}
          </Card>
          {meta && meta.totalPages > 1 ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {meta.page} of {meta.totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => setPage(meta.page - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => setPage(meta.page + 1)}>
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon={Bell}
          title={tab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          description="Parking events, pickup requests and assignments will appear here in real time."
        />
      )}
    </div>
  );
}
