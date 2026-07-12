import { Badge } from '@/components/ui/badge';
import type { ParkingStatus, PickupStatus } from '@/types';

const parkingConfig: Record<ParkingStatus, { label: string; variant: 'success' | 'warning' | 'info' | 'secondary' | 'destructive' }> = {
  PARKED: { label: 'Parked', variant: 'success' },
  PICKUP_REQUESTED: { label: 'Pickup requested', variant: 'warning' },
  PICKUP_IN_PROGRESS: { label: 'Pickup in progress', variant: 'info' },
  COMPLETED: { label: 'Completed', variant: 'secondary' },
  CANCELLED: { label: 'Cancelled', variant: 'destructive' },
};

const pickupConfig: Record<PickupStatus, { label: string; variant: 'success' | 'warning' | 'info' | 'secondary' | 'destructive' }> = {
  PENDING: { label: 'Pending', variant: 'warning' },
  ACCEPTED: { label: 'Accepted', variant: 'info' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'destructive' },
};

export function ParkingStatusBadge({ status }: { status: ParkingStatus }) {
  const config = parkingConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function PickupStatusBadge({ status }: { status: PickupStatus }) {
  const config = pickupConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function ActiveBadge({ isActive }: { isActive: boolean }) {
  return <Badge variant={isActive ? 'success' : 'secondary'}>{isActive ? 'Active' : 'Inactive'}</Badge>;
}
