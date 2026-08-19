import type { AppNotification } from '@/types';

function dataString(data: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = data?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function highlightDomId(id: string): string {
  return `notify-target-${id}`;
}

/** Path to open when a staff user clicks a notification (or the toast action). */
export function getNotificationHref(notification: Pick<AppNotification, 'type' | 'data'>): string | null {
  const data = notification.data;
  const parkingEntryId = dataString(data, 'parkingEntryId');
  const pickupRequestId = dataString(data, 'pickupRequestId');
  const organizationId = dataString(data, 'organizationId');
  const siteId = dataString(data, 'siteId');

  switch (notification.type) {
    case 'VEHICLE_PARKED': {
      const params = new URLSearchParams();
      if (parkingEntryId) params.set('entry', parkingEntryId);
      const query = params.toString();
      return query ? `/parking?${query}` : '/parking';
    }
    case 'PICKUP_REQUESTED':
    case 'PICKUP_ACCEPTED':
    case 'PICKUP_COMPLETED': {
      const params = new URLSearchParams();
      if (pickupRequestId) params.set('pickup', pickupRequestId);
      if (parkingEntryId) params.set('entry', parkingEntryId);
      const query = params.toString();
      return query ? `/parking?${query}` : '/parking';
    }
    case 'ORGANIZATION_CREATED':
      return organizationId ? `/organizations?highlight=${encodeURIComponent(organizationId)}` : '/organizations';
    case 'VALET_ASSIGNED':
    case 'VALET_UNASSIGNED':
      return siteId ? `/sites/${encodeURIComponent(siteId)}?highlight=1` : '/sites';
    default:
      return null;
  }
}
