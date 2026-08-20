/** localStorage flag so the browser permission prompt is shown only on first login. */
export const STAFF_ALERTS_ASKED_KEY = 'weepark.staffAlerts.asked';

export type BrowserNotificationPermission = 'default' | 'granted' | 'denied' | 'unsupported';

/** Ask for Notification permission only once, during the login click. */
export function shouldAskBrowserNotificationPermission(
  permission: BrowserNotificationPermission,
  alreadyAsked: boolean,
): boolean {
  return permission === 'default' && !alreadyAsked;
}

/** OS banner is for background tabs; foreground uses in-app toast + chime. */
export function shouldShowOsNotification(
  permission: BrowserNotificationPermission,
  documentHidden: boolean,
): boolean {
  return permission === 'granted' && documentHidden;
}

export function readAlreadyAsked(storage: Pick<Storage, 'getItem'> | null): boolean {
  if (!storage) return false;
  return storage.getItem(STAFF_ALERTS_ASKED_KEY) === '1';
}

export function markAsked(storage: Pick<Storage, 'setItem'> | null): void {
  storage?.setItem(STAFF_ALERTS_ASKED_KEY, '1');
}

export type PickupAlarmAction =
  | { kind: 'requested'; pickupRequestId: string }
  | { kind: 'resolved'; pickupRequestId: string }
  | { kind: 'sync'; pendingIds: readonly string[] }
  | { kind: 'clear' };

/** Pending pickup ids that should keep the repeating valet alarm running. */
export function applyPickupAlarmAction(pending: readonly string[], action: PickupAlarmAction): string[] {
  if (action.kind === 'clear') return [];
  if (action.kind === 'sync') {
    return [...new Set(action.pendingIds.filter((id) => id.length > 0))];
  }

  const next = new Set(pending);
  if (!action.pickupRequestId) return [...next];
  if (action.kind === 'requested') next.add(action.pickupRequestId);
  if (action.kind === 'resolved') next.delete(action.pickupRequestId);
  return [...next];
}

export function pickupAlarmShouldRun(pendingIds: readonly string[]): boolean {
  return pendingIds.length > 0;
}

/** Parked-vehicle alerts stay one-shot; unaccepted GET MY CAR keeps looping. */
export function shouldPlayOneShotChime(type: string): boolean {
  return type !== 'PICKUP_REQUESTED';
}

export function notificationToPickupAlarmAction(
  type: string,
  pickupRequestId: string | null | undefined,
): PickupAlarmAction | null {
  if (!pickupRequestId) return null;
  if (type === 'PICKUP_REQUESTED') return { kind: 'requested', pickupRequestId };
  if (type === 'PICKUP_ACCEPTED' || type === 'PICKUP_COMPLETED') {
    return { kind: 'resolved', pickupRequestId };
  }
  return null;
}
