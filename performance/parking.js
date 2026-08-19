import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 20,
  duration: '15s',
  thresholds: {
    http_req_failed: ['rate<0.1'],
    http_req_duration: ['p(95)<1500'],
  },
};

const BASE = __ENV.API_URL || 'http://localhost:4000';

export default function () {
  const health = http.get(`${BASE}/health`);
  check(health, { 'health is up': (r) => r.status === 200 });

  const lookup = http.post(
    `${BASE}/api/v1/public/parking/sites/WP-ABCDEF/lookup`,
    JSON.stringify({ vehicleNumber: 'KA01AB1234' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(lookup, { 'lookup is not a server error': (r) => r.status < 500 });
  sleep(0.2);
}
