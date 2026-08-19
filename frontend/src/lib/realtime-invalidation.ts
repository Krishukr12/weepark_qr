import type { NotificationType } from '@/types';

/** Query prefixes to refetch after a live notification. Charts (trend/peak/usage) are not included. */
export function realtimeInvalidationKeys(type: NotificationType): string[][] {
  const keys: string[][] = [['notifications']];

  if (type.startsWith('PICKUP')) {
    keys.push(['pickups'], ['parking'], ['dashboard', 'stats'], ['sites']);
  }
  if (type === 'VEHICLE_PARKED') {
    keys.push(['parking'], ['sites'], ['dashboard', 'stats']);
  }
  if (type === 'ORGANIZATION_CREATED') {
    keys.push(['organizations']);
  }
  if (type === 'VALET_ASSIGNED' || type === 'VALET_UNASSIGNED') {
    keys.push(['sites'], ['valets']);
  }

  return keys;
}

export const FILTER_OPTIONS_STALE_MS = 5 * 60_000;

export function shouldFetchNavUnreadList(open: boolean): boolean {
  return open;
}
