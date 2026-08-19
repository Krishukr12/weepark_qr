import { describe, it, expect } from 'vitest';
import { getNotificationHref, highlightDomId } from '@/lib/notification-target';
import type { AppNotification, NotificationType } from '@/types';

function note(
  type: NotificationType,
  data: Record<string, unknown> | null = null,
): Pick<AppNotification, 'type' | 'data'> {
  return { type, data };
}

describe('highlightDomId', () => {
  it('prefixes the target id for scroll-into-view', () => {
    expect(highlightDomId('abc')).toBe('notify-target-abc');
  });
});

describe('getNotificationHref', () => {
  it('opens parking history for a parked vehicle', () => {
    expect(getNotificationHref(note('VEHICLE_PARKED', { parkingEntryId: 'entry-1', siteId: 'site-1' }))).toBe(
      '/parking?entry=entry-1',
    );
  });

  it('falls back to parking when parked payload has no entry id', () => {
    expect(getNotificationHref(note('VEHICLE_PARKED', {}))).toBe('/parking');
  });

  it('opens parking with pickup and entry for pickup events', () => {
    expect(
      getNotificationHref(
        note('PICKUP_REQUESTED', { pickupRequestId: 'pickup-1', parkingEntryId: 'entry-2', siteId: 'site-1' }),
      ),
    ).toBe('/parking?pickup=pickup-1&entry=entry-2');
    expect(getNotificationHref(note('PICKUP_COMPLETED', { parkingEntryId: 'entry-3' }))).toBe(
      '/parking?entry=entry-3',
    );
  });

  it('opens the organization list with a highlight', () => {
    expect(getNotificationHref(note('ORGANIZATION_CREATED', { organizationId: 'org-9' }))).toBe(
      '/organizations?highlight=org-9',
    );
    expect(getNotificationHref(note('ORGANIZATION_CREATED', {}))).toBe('/organizations');
  });

  it('opens the assigned site with a highlight flag', () => {
    expect(getNotificationHref(note('VALET_ASSIGNED', { siteId: 'site-4', siteCode: 'WP-ABC123' }))).toBe(
      '/sites/site-4?highlight=1',
    );
    expect(getNotificationHref(note('VALET_UNASSIGNED', {}))).toBe('/sites');
  });

  it('does not invent a destination for system notices', () => {
    expect(getNotificationHref(note('SYSTEM', { foo: 'bar' }))).toBeNull();
  });

  it('ignores non-string payload ids', () => {
    expect(getNotificationHref(note('VEHICLE_PARKED', { parkingEntryId: 123 }))).toBe('/parking');
  });
});
