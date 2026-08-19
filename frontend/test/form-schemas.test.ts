import { describe, it, expect } from 'vitest';
import type { z } from 'zod';
import {
  employeeSchema,
  forgotPasswordSchema,
  loginSchema,
  orgSchema,
  profileSchema,
  publicRegisterSchema,
  resetPasswordSchema,
  siteSchema,
  valetSchema,
  vehicleSchema,
} from '@/lib/form-schemas';
import { authResponseSchema, parseResponse, vehicleLookupSchema } from '@/lib/response-schemas';

function messages(schema: z.ZodType, data: unknown): string[] {
  const result = schema.safeParse(data);
  expect(result.success).toBe(false);
  if (result.success) return [];
  return result.error.issues.map((issue) => issue.message);
}

describe('loginSchema', () => {
  it('accepts a valid email and password', () => {
    expect(loginSchema.safeParse({ email: 'admin@company.com', password: 'secret' }).success).toBe(true);
  });

  it('rejects missing or invalid email and empty password', () => {
    expect(messages(loginSchema, { email: '', password: 'secret' })).toContain('Enter a valid email address');
    expect(messages(loginSchema, { email: 'not-an-email', password: 'secret' })).toContain('Enter a valid email address');
    expect(messages(loginSchema, { email: 'admin@company.com', password: '' })).toContain('Password is required');
  });
});

describe('forgotPasswordSchema', () => {
  it('rejects an invalid email', () => {
    expect(messages(forgotPasswordSchema, { email: 'nope' })).toContain('Enter a valid email address');
  });
});

describe('resetPasswordSchema', () => {
  it('accepts a strong matching password pair', () => {
    expect(
      resetPasswordSchema.safeParse({ password: 'NewPass1234', confirmPassword: 'NewPass1234' }).success,
    ).toBe(true);
  });

  it('rejects a weak password and a mismatch', () => {
    expect(messages(resetPasswordSchema, { password: 'short', confirmPassword: 'short' })).toContain(
      'At least 8 characters',
    );
    expect(messages(resetPasswordSchema, { password: 'nouppercase1', confirmPassword: 'nouppercase1' })).toContain(
      'Include an uppercase letter',
    );
    expect(messages(resetPasswordSchema, { password: 'NoNumberHere', confirmPassword: 'NoNumberHere' })).toContain(
      'Include a number',
    );
    expect(messages(resetPasswordSchema, { password: 'NewPass1234', confirmPassword: 'OtherPass1234' })).toContain(
      'Passwords do not match',
    );
  });
});

describe('publicRegisterSchema', () => {
  const valid = {
    vehicleType: 'CAR',
    fuelType: 'PETROL',
    brand: '',
    model: '',
    color: '',
    employeeName: 'Arjun Rao',
    employeeEmail: 'arjun@company.com',
    employeePhone: '9876543210',
    employeeCode: 'E1',
    organizationId: 'org-1',
  };

  it('accepts a complete registration payload', () => {
    expect(publicRegisterSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects short name, bad email, short phone, missing org and employee id', () => {
    expect(messages(publicRegisterSchema, { ...valid, employeeName: 'A' })).toContain('Enter your name');
    expect(messages(publicRegisterSchema, { ...valid, employeeEmail: 'bad' })).toContain('Enter a valid email');
    expect(messages(publicRegisterSchema, { ...valid, employeePhone: '123' })).toContain('Enter a valid phone');
    expect(messages(publicRegisterSchema, { ...valid, employeeCode: '' })).toContain('Enter your employee ID');
    expect(messages(publicRegisterSchema, { ...valid, organizationId: '' })).toContain('Select your organization');
    expect(publicRegisterSchema.safeParse({ ...valid, vehicleType: 'SPACESHIP' }).success).toBe(false);
  });
});

describe('vehicleSchema', () => {
  const valid = {
    vehicleNumber: 'KA01AB1234',
    vehicleType: 'CAR',
    brand: '',
    model: '',
    color: '',
    fuelType: 'PETROL',
    rcNumber: '',
    isPrimary: false,
    employeeId: 'emp-1',
  };

  it('accepts a valid vehicle', () => {
    expect(vehicleSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a short plate, missing employee, and unknown type', () => {
    expect(messages(vehicleSchema, { ...valid, vehicleNumber: 'KA' })).toContain('Vehicle number is too short');
    expect(messages(vehicleSchema, { ...valid, employeeId: '' })).toContain('Select an employee');
    expect(vehicleSchema.safeParse({ ...valid, vehicleType: 'SPACESHIP' }).success).toBe(false);
  });
});

describe('valetSchema', () => {
  const valid = {
    name: 'Valet One',
    email: 'valet@weepark.io',
    phone: '9876543210',
    password: 'ValetPass1234',
    photoUrl: '',
    siteIds: [],
  };

  it('accepts a valid valet, including an empty password for edits', () => {
    expect(valetSchema.safeParse(valid).success).toBe(true);
    expect(valetSchema.safeParse({ ...valid, password: '' }).success).toBe(true);
  });

  it('rejects short name, bad email, short phone, weak password, and bad photo URL', () => {
    expect(messages(valetSchema, { ...valid, name: 'V' })).toContain('Name is too short');
    expect(messages(valetSchema, { ...valid, email: 'nope' })).toContain('Enter a valid email');
    expect(messages(valetSchema, { ...valid, phone: '12' })).toContain('Enter a valid phone number');
    expect(messages(valetSchema, { ...valid, password: 'weak' })).toContain('At least 8 characters');
    expect(messages(valetSchema, { ...valid, photoUrl: 'not-a-url' })).toContain('Enter a valid URL');
  });
});

describe('employeeSchema', () => {
  const valid = {
    employeeCode: 'E1',
    name: 'Arjun',
    department: '',
    designation: '',
    phone: '',
    email: 'arjun@company.com',
  };

  it('accepts a valid employee', () => {
    expect(employeeSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects missing code, short name, and invalid email', () => {
    expect(messages(employeeSchema, { ...valid, employeeCode: '' })).toContain('Employee ID is required');
    expect(messages(employeeSchema, { ...valid, name: 'A' })).toContain('Name is too short');
    expect(messages(employeeSchema, { ...valid, email: 'bad' })).toContain('Enter a valid email');
  });
});

describe('orgSchema', () => {
  const valid = {
    name: 'Acme',
    companyName: 'Acme Pvt Ltd',
    gstNumber: '',
    adminName: 'Org Admin',
    adminEmail: 'admin@acme.com',
    adminPhone: '',
    address: '',
    logoUrl: '',
    siteAllocations: [{ siteId: 'site-1', allocatedSpaces: 10 }],
  };

  it('accepts a valid organization', () => {
    expect(orgSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects short names, invalid admin email, bad logo URL, and zero allocated spaces', () => {
    expect(messages(orgSchema, { ...valid, name: 'A' })).toContain('Organization name is too short');
    expect(messages(orgSchema, { ...valid, companyName: 'A' })).toContain('Company name is too short');
    expect(messages(orgSchema, { ...valid, adminName: 'A' })).toContain('Admin name is too short');
    expect(messages(orgSchema, { ...valid, adminEmail: 'bad' })).toContain('Enter a valid email');
    expect(messages(orgSchema, { ...valid, logoUrl: 'not-a-url' })).toContain('Enter a valid URL');
    expect(messages(orgSchema, { ...valid, siteAllocations: [{ siteId: 'site-1', allocatedSpaces: 0 }] })).toContain(
      'At least 1 space',
    );
  });
});

describe('siteSchema', () => {
  const valid = {
    name: 'Tower A',
    address: '12 MG Road',
    googleMapsLink: '',
    totalCapacity: 50,
    isActive: true,
  };

  it('accepts a valid site', () => {
    expect(siteSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects short name/address, invalid maps URL, and capacity below 1', () => {
    expect(messages(siteSchema, { ...valid, name: 'A' })).toContain('Site name is too short');
    expect(messages(siteSchema, { ...valid, address: 'x' })).toContain('Address is too short');
    expect(messages(siteSchema, { ...valid, googleMapsLink: 'not-a-url' })).toContain('Enter a valid URL');
    expect(messages(siteSchema, { ...valid, totalCapacity: 0 })).toContain('Capacity must be at least 1');
  });
});

describe('profileSchema', () => {
  it('rejects a short name and an invalid photo URL', () => {
    expect(messages(profileSchema, { name: 'A', phone: '', photoUrl: '' })).toContain('Name is too short');
    expect(messages(profileSchema, { name: 'Admin', phone: '', photoUrl: 'nope' })).toContain('Enter a valid URL');
  });
});

describe('API response contracts', () => {
  it('rejects a login payload that has no access token', () => {
    expect(() =>
      parseResponse(
        authResponseSchema,
        {
          user: {
            id: 'clxxxxxxxxxxxxxxxxxxxxxxx',
            name: 'A',
            email: 'a@b.com',
            role: 'ORG_ADMIN',
            organizationId: null,
            isActive: true,
          },
          refreshToken: 'nope',
        },
        'login',
      ),
    ).toThrow(/unexpected login/i);
  });

  it('strips unexpected PII from a public vehicle lookup display', () => {
    const parsed = vehicleLookupSchema.safeParse({
      found: true,
      canParkAtSite: true,
      alreadyParked: false,
      vehicleNumber: 'KA01AB1234',
      display: {
        vehicleNumber: 'KA01AB1234',
        vehicleType: 'CAR',
        employeeName: 'A',
        employeeCode: 'E1',
        organizationName: 'Acme',
        email: 'secret@x.com',
      },
      site: { name: 'S', siteCode: 'WP-ABC234' },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(JSON.stringify(parsed.data.display)).not.toMatch(/secret@x.com/);
    }
  });
});
