import crypto from 'crypto';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomCode(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return out;
}

/** Site codes look like WP-K7M2Q9 — short enough to print under a QR. */
export function generateSiteCode(): string {
  return `WP-${randomCode(6)}`;
}

/** Ticket codes look like TKT-20260712-A8C3F1. */
export function generateTicketCode(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `TKT-${date}-${randomCode(6)}`;
}

export function normalizeVehicleNumber(value: string): string {
  return value.toUpperCase().replace(/[\s-]/g, '');
}
