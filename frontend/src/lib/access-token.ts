/** True when the JWT still has more than `skewMs` before expiry. */
export function isAccessTokenFresh(token: string, now = Date.now(), skewMs = 30_000): boolean {
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return false;
    const b64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json = atob(padded);
    const payload = JSON.parse(json) as { exp?: unknown };
    return typeof payload.exp === 'number' && payload.exp * 1000 - now > skewMs;
  } catch {
    return false;
  }
}
