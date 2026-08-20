import { describe, it, expect } from 'vitest';
import {
  FILTER_OPTIONS_STALE_MS,
  realtimeInvalidationKeys,
  shouldFetchNavUnreadList,
} from '@/lib/realtime-invalidation';
import type { NotificationType } from '@/types';

function keys(type: NotificationType): string {
  return realtimeInvalidationKeys(type)
    .map((k) => k.join('/'))
    .sort()
    .join(',');
}

describe('shouldFetchNavUnreadList', () => {
  it('loads the navbar list only when the bell is open', () => {
    expect(shouldFetchNavUnreadList(false)).toBe(false);
    expect(shouldFetchNavUnreadList(true)).toBe(true);
  });
});

describe('FILTER_OPTIONS_STALE_MS', () => {
  it('keeps parking filter dropdowns cached for five minutes', () => {
    expect(FILTER_OPTIONS_STALE_MS).toBe(5 * 60_000);
  });
});

describe('realtimeInvalidationKeys', () => {
  it('always refreshes notifications', () => {
    expect(realtimeInvalidationKeys('SYSTEM')).toEqual([['notifications']]);
  });

  it('refreshes live parking slices on VEHICLE_PARKED without dashboard charts', () => {
    const set = realtimeInvalidationKeys('VEHICLE_PARKED').map((k) => k.join('/'));
    expect(set).toEqual(expect.arrayContaining(['notifications', 'parking', 'sites', 'dashboard/stats']));
    expect(set).not.toContain('dashboard');
    expect(set.some((k) => k.startsWith('dashboard/') && k !== 'dashboard/stats')).toBe(false);
  });

  it('refreshes pickups, parking, sites, and stats on pickup events', () => {
    expect(keys('PICKUP_REQUESTED')).toBe(keys('PICKUP_COMPLETED'));
    expect(keys('PICKUP_REQUESTED')).toBe(keys('PICKUP_ACCEPTED'));
    const set = realtimeInvalidationKeys('PICKUP_REQUESTED').map((k) => k.join('/'));
    expect(set).toEqual(
      expect.arrayContaining(['notifications', 'pickups', 'parking', 'dashboard/stats', 'sites']),
    );
    expect(set).not.toContain('dashboard');
  });

  it('refreshes organizations only for onboard events', () => {
    expect(realtimeInvalidationKeys('ORGANIZATION_CREATED')).toEqual([['notifications'], ['organizations']]);
  });

  it('refreshes sites and valets on assignment changes', () => {
    expect(realtimeInvalidationKeys('VALET_ASSIGNED')).toEqual([['notifications'], ['sites'], ['valets']]);
    expect(realtimeInvalidationKeys('VALET_UNASSIGNED')).toEqual([['notifications'], ['sites'], ['valets']]);
  });
});
