import { describe, it, expect } from 'vitest';
import {
  shouldAskBrowserNotificationPermission,
  shouldShowOsNotification,
  readAlreadyAsked,
  markAsked,
  STAFF_ALERTS_ASKED_KEY,
  applyPickupAlarmAction,
  pickupAlarmShouldRun,
  notificationToPickupAlarmAction,
  shouldPlayOneShotChime,
} from '@/lib/staff-alert-policy';
import { isAccessTokenFresh } from '@/lib/access-token';

function fakeJwt(expSeconds: number): string {
  const payload = btoa(JSON.stringify({ exp: expSeconds }));
  return `eyJhbGciOiJub25lIn0.${payload}.sig`;
}

describe('staff alert permission policy', () => {
  it('asks for OS notifications only on the first login while permission is default', () => {
    expect(shouldAskBrowserNotificationPermission('default', false)).toBe(true);
    expect(shouldAskBrowserNotificationPermission('default', true)).toBe(false);
    expect(shouldAskBrowserNotificationPermission('granted', false)).toBe(false);
    expect(shouldAskBrowserNotificationPermission('denied', false)).toBe(false);
    expect(shouldAskBrowserNotificationPermission('unsupported', false)).toBe(false);
  });

  it('shows an OS banner only when the tab is hidden and permission was granted', () => {
    expect(shouldShowOsNotification('granted', true)).toBe(true);
    expect(shouldShowOsNotification('granted', false)).toBe(false);
    expect(shouldShowOsNotification('default', true)).toBe(false);
    expect(shouldShowOsNotification('denied', true)).toBe(false);
  });

  it('remembers that the login prompt already ran', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };
    expect(readAlreadyAsked(storage)).toBe(false);
    markAsked(storage);
    expect(store.get(STAFF_ALERTS_ASKED_KEY)).toBe('1');
    expect(readAlreadyAsked(storage)).toBe(true);
  });
});

describe('isAccessTokenFresh', () => {
  it('treats a token with enough remaining life as fresh', () => {
    const exp = Math.floor(Date.now() / 1000) + 120;
    expect(isAccessTokenFresh(fakeJwt(exp))).toBe(true);
  });

  it('treats an expired or near-expiry token as stale', () => {
    const exp = Math.floor(Date.now() / 1000) + 5;
    expect(isAccessTokenFresh(fakeJwt(exp))).toBe(false);
    expect(isAccessTokenFresh('not-a-jwt')).toBe(false);
  });
});

describe('pickup alarm until accepted', () => {
  it('starts on PICKUP_REQUESTED and keeps running while any request is open', () => {
    let pending = applyPickupAlarmAction([], { kind: 'requested', pickupRequestId: 'p1' });
    expect(pickupAlarmShouldRun(pending)).toBe(true);
    pending = applyPickupAlarmAction(pending, { kind: 'requested', pickupRequestId: 'p2' });
    pending = applyPickupAlarmAction(pending, { kind: 'resolved', pickupRequestId: 'p1' });
    expect(pending).toEqual(['p2']);
    expect(pickupAlarmShouldRun(pending)).toBe(true);
  });

  it('stops only after the last unaccepted pickup is resolved', () => {
    const pending = applyPickupAlarmAction(['p2'], { kind: 'resolved', pickupRequestId: 'p2' });
    expect(pending).toEqual([]);
    expect(pickupAlarmShouldRun(pending)).toBe(false);
  });

  it('syncs to the live pending queue and clears on logout', () => {
    expect(applyPickupAlarmAction(['stale'], { kind: 'sync', pendingIds: ['live-1', 'live-1'] })).toEqual(['live-1']);
    expect(applyPickupAlarmAction(['live-1'], { kind: 'clear' })).toEqual([]);
  });

  it('maps notification types to alarm start/stop and leaves parked events alone', () => {
    expect(notificationToPickupAlarmAction('PICKUP_REQUESTED', 'p1')).toEqual({
      kind: 'requested',
      pickupRequestId: 'p1',
    });
    expect(notificationToPickupAlarmAction('PICKUP_ACCEPTED', 'p1')).toEqual({
      kind: 'resolved',
      pickupRequestId: 'p1',
    });
    expect(notificationToPickupAlarmAction('PICKUP_COMPLETED', 'p1')).toEqual({
      kind: 'resolved',
      pickupRequestId: 'p1',
    });
    expect(notificationToPickupAlarmAction('VEHICLE_PARKED', 'p1')).toBeNull();
    expect(notificationToPickupAlarmAction('PICKUP_REQUESTED', null)).toBeNull();
  });

  it('uses the looping alarm for pickup requests and a one-shot chime for other staff events', () => {
    expect(shouldPlayOneShotChime('PICKUP_REQUESTED')).toBe(false);
    expect(shouldPlayOneShotChime('VEHICLE_PARKED')).toBe(true);
    expect(shouldPlayOneShotChime('PICKUP_ACCEPTED')).toBe(true);
    expect(shouldPlayOneShotChime('ORGANIZATION_CREATED')).toBe(true);
  });
});
