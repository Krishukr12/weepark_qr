import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { vehicleNumberSchema, siteCodeSchema, strictInt, dateRangeRefine } from '../../src/validators/common';
import { generateSiteCode, normalizeVehicleNumber } from '../../src/utils/codes';

describe('property-based validation', () => {
  it('generated site codes always match the schema', () => {
    fc.assert(
      fc.property(fc.constantFrom(...Array.from({ length: 20 }, () => generateSiteCode())), (code) => {
        expect(siteCodeSchema.safeParse(code).success).toBe(true);
      }),
    );
  });

  it('alphanumeric plates of length 4–20 always normalize', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-zA-Z0-9]{4,20}$/), (raw) => {
        const parsed = vehicleNumberSchema.safeParse(raw);
        expect(parsed.success).toBe(true);
        if (parsed.success) expect(parsed.data).toBe(normalizeVehicleNumber(raw));
      }),
      { numRuns: 40 },
    );
  });

  it('strictInt never accepts strings or non-integers', () => {
    const schema = strictInt(1, 1000);
    fc.assert(
      fc.property(fc.string(), (value) => {
        expect(schema.safeParse(value).success).toBe(false);
      }),
      { numRuns: 30 },
    );
    fc.assert(
      fc.property(fc.double({ min: Math.fround(1.1), max: Math.fround(999.9), noNaN: true }), (n) => {
        if (!Number.isInteger(n)) expect(schema.safeParse(n).success).toBe(false);
      }),
      { numRuns: 30 },
    );
  });

  it('dateFrom after dateTo is always invalid', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10_000 }), (delta) => {
        const dateTo = new Date('2026-01-01T00:00:00Z');
        const dateFrom = new Date(dateTo.getTime() + delta * 60_000);
        expect(dateRangeRefine({ dateFrom, dateTo })).toBe(false);
      }),
      { numRuns: 20 },
    );
  });
});
