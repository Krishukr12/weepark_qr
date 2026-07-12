import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { BellRing, Car, CheckCircle2, Hand } from 'lucide-react';
import { pickupsApi } from '@/api/domain.api';
import { getApiErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PickupStatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import type { PickupRequest } from '@/types';

function PickupRow({ pickup }: { pickup: PickupRequest }) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['pickups'] });
    void queryClient.invalidateQueries({ queryKey: ['parking'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const accept = useMutation({
    mutationFn: () => pickupsApi.accept(pickup.id),
    onSuccess: () => {
      toast.success(`Accepted pickup for ${pickup.parkingEntry.vehicle.vehicleNumber}`);
      invalidate();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const complete = useMutation({
    mutationFn: () => pickupsApi.complete(pickup.id),
    onSuccess: () => {
      toast.success(`Delivered ${pickup.parkingEntry.vehicle.vehicleNumber}`);
      invalidate();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const { vehicle, employee, site } = pickup.parkingEntry;

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/12">
          <Car className="size-5 text-brand" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-sm font-semibold">{vehicle.vehicleNumber}</p>
            <PickupStatusBadge status={pickup.status} />
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {employee.name} · {site.name}
          </p>
          <p className="text-xs text-muted-foreground">
            Requested {formatDistanceToNow(new Date(pickup.requestedAt), { addSuffix: true })}
            {employee.phone ? ` · ${employee.phone}` : ''}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        {pickup.status === 'PENDING' ? (
          <Button size="sm" variant="brand" onClick={() => accept.mutate()} loading={accept.isPending}>
            <Hand /> Accept
          </Button>
        ) : null}
        {pickup.status === 'ACCEPTED' ? (
          <Button size="sm" onClick={() => complete.mutate()} loading={complete.isPending}>
            <CheckCircle2 /> Complete
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Live pickup queue for valets — shown on the dashboard and parking page. */
export function PendingPickupsPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['pickups', 'active'],
    queryFn: async () => {
      const [pending, accepted] = await Promise.all([
        pickupsApi.list({ page: 1, limit: 20, status: 'PENDING' }),
        pickupsApi.list({ page: 1, limit: 20, status: 'ACCEPTED' }),
      ]);
      return [...pending.data, ...accepted.data];
    },
    refetchInterval: 30_000,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <BellRing className="size-4.5 text-brand" />
            Pickup Requests
          </CardTitle>
          <CardDescription>Live queue for your assigned sites</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
        ) : data && data.length > 0 ? (
          data.map((pickup) => <PickupRow key={pickup.id} pickup={pickup} />)
        ) : (
          <EmptyState icon={BellRing} title="No active pickups" description="New pickup requests will appear here instantly." />
        )}
      </CardContent>
    </Card>
  );
}
