import http from 'k6/http';
import { check, sleep } from 'k6';

const maxVus = Number(__ENV.MAX_VUS || 50);
if (![50, 100].includes(maxVus)) throw new Error('MAX_VUS must be 50 or 100');

export const options = {
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  scenarios: {
    smoke: {
      executor: 'ramping-vus',
      stages: maxVus === 100 ? [
        { duration: '30s', target: 20 },
        { duration: '1m', target: 50 },
        { duration: '1m', target: 100 },
        { duration: '1m', target: 100 },
        { duration: '30s', target: 0 },
      ] : [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 25 },
        { duration: '1m', target: 50 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    checks: ['rate==1'],
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<750', 'p(99)<1500'],
  },
};

const baseUrl = __ENV.BASE_URL || 'http://localhost:8080';
const token = __ENV.ACCESS_TOKEN || '';
const tokens = __ENV.ACCESS_TOKENS ? JSON.parse(__ENV.ACCESS_TOKENS)
  : Array.from({ length: maxVus }, (_, i) => __ENV[`ACCESS_TOKEN_${i + 1}`]).filter(Boolean);

export default function () {
  // A distinct identity per VU respects the production per-user rate limit.
  const headers = { Authorization: `Bearer ${tokens.length ? tokens[(__VU - 1) % tokens.length] : token}` };
  const members = http.get(`${baseUrl}/api/v1/members?page=1&pageSize=25`, { headers });
  check(members, { 'members 200': (r) => r.status === 200 });

  const dashboard = http.get(`${baseUrl}/api/v1/dashboard/summary`, { headers });
  check(dashboard, { 'dashboard 200': (r) => r.status === 200 });

  const classes = http.get(`${baseUrl}/api/v1/classes/sessions?page=1&pageSize=25`, { headers });
  check(classes, { 'classes 200': (r) => r.status === 200 });
  sleep(1);
}
