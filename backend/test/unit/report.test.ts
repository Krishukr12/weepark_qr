import { describe, it, expect } from 'vitest';
import { reportService } from '../../src/services/report.service';
import type { ParkingEntryFull } from '../../src/repositories/parking.repository';

function entry(overrides: Partial<{ phone: string | null; name: string }> = {}): ParkingEntryFull {
  return {
    ticketCode: 'WP-TEST-TICKET',
    vehicle: { vehicleNumber: 'KA01AB1234', vehicleType: 'CAR' },
    employee: {
      name: overrides.name ?? 'Guest',
      employeeCode: 'GUEST-9000000010',
      phone: overrides.phone === undefined ? '9000000010' : overrides.phone,
    },
    organization: { name: 'Walk-in Co' },
    site: { name: 'Forum Mall' },
    valet: null,
    status: 'PARKED',
    parkedAt: new Date('2026-08-19T10:00:00.000Z'),
    pickedUpAt: null,
    durationMinutes: null,
  } as unknown as ParkingEntryFull;
}

describe('parking history export', () => {
  it('includes a Phone column and guest number in CSV', () => {
    const csv = reportService.toCsv([entry()]);
    const [header, row] = csv.split('\n');
    expect(header.split(',')).toContain('Phone');
    expect(row).toContain('9000000010');
    expect(row).toContain('Guest');
  });

  it('exports an empty phone cell when the guest number is missing', () => {
    const csv = reportService.toCsv([entry({ phone: null })]);
    const cols = csv.split('\n')[1].split(',');
    const phoneIndex = csv.split('\n')[0].split(',').indexOf('Phone');
    expect(cols[phoneIndex]).toBe('');
  });
});
