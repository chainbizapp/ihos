/**
 * k6 Performance Load Test — GET /api/plans/search
 *
 * Goal: assert p95 response time < 2000ms under 50 VUs for 60 seconds.
 *
 * Usage:
 *   k6 run tests/performance/search_load.js
 *   k6 run --env BASE_URL=http://localhost:5000 tests/performance/search_load.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// ── Configuration ──────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

// Vehicle model ID seeded during integration tests / development seed.
// Override via: k6 run --env MODEL_ID=<uuid>
const MODEL_ID = __ENV.MODEL_ID || '00000000-0000-0000-0000-000000000001';

export const options = {
  vus: 50,
  duration: '60s',
  thresholds: {
    // p95 must be below 2000ms
    http_req_duration: ['p(95)<2000'],
    // Error rate must stay below 1%
    errors: ['rate<0.01'],
  },
};

// ── Custom metrics ─────────────────────────────────────────────────────────────
const searchDuration = new Trend('search_duration', true);
const errorRate      = new Rate('errors');

// ── Helpers ────────────────────────────────────────────────────────────────────
function randomYear() {
  // Production years spanning age 1–15
  const age = Math.floor(Math.random() * 15) + 1;
  return new Date().getFullYear() - age;
}

const planTypes   = ['Type1', 'Type2', 'Type3'];
const repairTypes = ['Garage', 'Dealer'];

function randomPlanType()   { return planTypes[Math.floor(Math.random() * planTypes.length)]; }
function randomRepairType() { return repairTypes[Math.floor(Math.random() * repairTypes.length)]; }

// ── Default function (executed by each VU on each iteration) ──────────────────
export default function () {
  const productionYear = randomYear();
  const planType       = randomPlanType();
  const repairType     = randomRepairType();

  const url = `${BASE_URL}/api/plans/search` +
    `?vehicleModelId=${MODEL_ID}` +
    `&productionYear=${productionYear}` +
    `&planType=${planType}` +
    `&repairType=${repairType}`;

  const res = http.get(url, {
    tags: { name: 'search_plans' },
  });

  searchDuration.add(res.timings.duration);

  const ok = check(res, {
    'status 200':    (r) => r.status === 200,
    'body not empty': (r) => r.body && r.body.length > 0,
  });

  errorRate.add(!ok);

  // Small think-time to avoid flooding; realistic user cadence
  sleep(0.5);
}

// ── Setup: authenticate and obtain a Bearer token ─────────────────────────────
export function setup() {
  const loginUrl = `${BASE_URL}/api/auth/login`;
  const payload  = JSON.stringify({
    email:    __ENV.TEST_EMAIL    || 'admin@ihos.local',
    password: __ENV.TEST_PASSWORD || 'Admin@1234',
  });

  const res = http.post(loginUrl, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (res.status !== 200) {
    console.error(`Login failed: ${res.status} ${res.body}`);
    return { token: null };
  }

  const body = JSON.parse(res.body);
  return { token: body.accessToken };
}

// ── Use token in default function via __ENV workaround ───────────────────────
// k6 passes setup() data as first arg; override default with data param
export { default as _default } from 'k6/http';

// Re-export the main default function with token support
export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration?.values?.['p(95)'];
  const errRate = data.metrics.errors?.values?.rate;

  const passed = p95 !== undefined && p95 < 2000 && errRate < 0.01;

  console.log(`\n━━ Load Test Summary ━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  p95 response time : ${p95 ? p95.toFixed(1) + 'ms' : 'N/A'} (threshold: <2000ms)`);
  console.log(`  Error rate        : ${errRate !== undefined ? (errRate * 100).toFixed(2) + '%' : 'N/A'} (threshold: <1%)`);
  console.log(`  Result            : ${passed ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  return {
    stdout: JSON.stringify(data, null, 2),
  };
}
