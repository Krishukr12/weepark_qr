import { describe, it, expect } from 'vitest';
import { cuidId, siteCodeSchema, vehicleNumberSchema, phoneSchema, strictInt, dateRangeRefine } from '../../src/validators/common';
import { generateSiteCode, generateTicketCode, normalizeVehicleNumber } from '../../src/utils/codes';
import { getPagination } from '../../src/utils/pagination';
import { hashToken, parseDurationToMs } from '../../src/utils/token';
import { escapeHtml } from '../../src/utils/html';
import { signParkAuth, verifyParkAuth, signParkSession, verifyParkSession } from '../../src/utils/parkingToken';
import { ApiError } from '../../src/utils/apiError';
import type { Request } from 'express';

function fakeReq(query: Record<string, unknown>): Request {
  return { query } as unknown as Request;
}

describe('common validators', () => {
  it('accepts cuid-shaped ids and rejects others', () => {
    expect(cuidId.safeParse('clxxxxxxxxxxxxxxxxxxxxxxx').success).toBe(true);
    expect(cuidId.safeParse('not-a-cuid').success).toBe(false);
    expect(cuidId.safeParse('').success).toBe(false);
  });

  it('accepts generated site codes', () => {
    const code = generateSiteCode();
    expect(siteCodeSchema.safeParse(code).success).toBe(true);
    expect(siteCodeSchema.safeParse('WP-000000').success).toBe(false);
    expect(siteCodeSchema.safeParse('INVALID').success).toBe(false);
  });

  it('normalizes vehicle numbers', () => {
    expect(vehicleNumberSchema.parse('ka 01 ab 1234')).toBe('KA01AB1234');
    expect(vehicleNumberSchema.safeParse('ab').success).toBe(false);
    expect(vehicleNumberSchema.safeParse('KA@01').success).toBe(false);
    expect(normalizeVehicleNumber('ka-01-ab')).toBe('KA01AB');
  });

  it('validates phones', () => {
    expect(phoneSchema.parse('98765 43210')).toBe('9876543210');
    expect(phoneSchema.safeParse('abc').success).toBe(false);
  });

  it('rejects string JSON integers', () => {
    const capacity = strictInt(1, 100000);
    expect(capacity.parse(100)).toBe(100);
    expect(capacity.safeParse('100').success).toBe(false);
    expect(capacity.safeParse('abc').success).toBe(false);
    expect(capacity.safeParse(-1).success).toBe(false);
    expect(capacity.safeParse(10.5).success).toBe(false);
    expect(capacity.safeParse(0).success).toBe(false);
  });

  it('rejects inverted date ranges', () => {
    expect(dateRangeRefine({ dateFrom: new Date('2026-02-01'), dateTo: new Date('2026-01-01') })).toBe(false);
    expect(dateRangeRefine({ dateFrom: new Date('2026-01-01'), dateTo: new Date('2026-02-01') })).toBe(true);
  });
});

describe('pagination', () => {
  it('defaults page and limit', () => {
    const p = getPagination(fakeReq({}));
    expect(p.page).toBe(1);
    expect(p.limit).toBe(10);
  });

  it('caps limit at 100', () => {
    expect(getPagination(fakeReq({ limit: '500' })).limit).toBe(100);
  });

  it('treats invalid page as 1', () => {
    expect(getPagination(fakeReq({ page: '-2' })).page).toBe(1);
    expect(getPagination(fakeReq({ page: 'abc' })).page).toBe(1);
  });

  it('rejects unknown sortBy', () => {
    expect(() => getPagination(fakeReq({ sortBy: 'passwordHash' }))).toThrow(ApiError);
  });

  it('truncates search to 100 chars', () => {
    const p = getPagination(fakeReq({ search: 'x'.repeat(200) }));
    expect(p.search?.length).toBe(100);
  });
});

describe('tokens and html', () => {
  it('hashes tokens stably', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).not.toBe(hashToken('abd'));
  });

  it('parses duration strings', () => {
    expect(parseDurationToMs('15m')).toBe(15 * 60_000);
    expect(parseDurationToMs('7d')).toBe(7 * 86_400_000);
  });

  it('escapes HTML', () => {
    expect(escapeHtml('<script>"x"</script>')).toBe('&lt;script&gt;&quot;x&quot;&lt;/script&gt;');
  });

  it('round-trips parking tokens and rejects the wrong type', () => {
    const auth = signParkAuth({ vehicleId: 'v1', siteId: 's1', siteCode: 'WP-ABCDEF' });
    expect(verifyParkAuth(auth).vehicleId).toBe('v1');
    const session = signParkSession({
      parkingEntryId: 'e1',
      ticketCode: 'TKT-1',
      vehicleNumber: 'KA01AB1234',
      siteId: 's1',
      siteCode: 'WP-ABCDEF',
    });
    expect(verifyParkSession(session).ticketCode).toBe('TKT-1');
    expect(() => verifyParkAuth(session)).toThrow(ApiError);
    expect(() => verifyParkAuth('tampered.token.value')).toThrow(ApiError);
  });

  it('generates ticket codes', () => {
    expect(generateTicketCode()).toMatch(/^TKT-\d{8}-[A-Z0-9]+$/);
  });
});
