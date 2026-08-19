import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import {
  ApiClient,
  cleanupTestData,
  createTenant,
  startTestServer,
  stopTestServer,
} from '../helpers';

describe('input validation via HTTP', () => {
  let admin: ApiClient;

  beforeAll(async () => {
    await startTestServer();
    await cleanupTestData();
    const tenant = await createTenant('val');
    admin = new ApiClient();
    await admin.login(tenant.admin.email, tenant.password);
  });

  afterAll(async () => {
    await cleanupTestData();
    await stopTestServer();
  });

  it('rejects malformed JSON types on employee create', async () => {
    const payloads = [
      { name: 'A', email: 'ok@wptest.local', employeeCode: 'E1' },
      { name: 'Valid Name', email: 'not-email', employeeCode: 'E1' },
      { name: 'Valid Name', email: 'ok@wptest.local', employeeCode: '' },
      { name: 'x'.repeat(500), email: 'ok@wptest.local', employeeCode: 'E1' },
    ];
    for (const body of payloads) {
      const res = await admin.request('/api/v1/employees', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      expect([400, 409]).toContain(res.status);
    }
  });

  it('rejects SQL-like vehicle numbers', async () => {
    const res = await admin.request('/api/v1/vehicles', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: 'clxxxxxxxxxxxxxxxxxxxxxxx',
        vehicleNumber: "KA01'; DROP TABLE vehicles;--",
        vehicleType: 'CAR',
      }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown enum', async () => {
    const tenant = await createTenant('enum');
    const res = await admin.request('/api/v1/vehicles', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: tenant.employee.id,
        vehicleNumber: 'KA01ENUM1',
        vehicleType: 'SPACESHIP',
      }),
    });
    expect(res.status).toBe(400);
  });
});
