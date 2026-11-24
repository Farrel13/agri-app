import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const failureRate = new Rate('api_failed_requests');
const responseTimeTrend = new Trend('api_req_duration');

// Konfigurasi Target URL (DEFAULT KE LOKAL)
const BASE_URL = __ENV.TARGET_URL || 'http://localhost:3000';

export const options = {
  // Skenario bertahap Serverless/Backend API di lokal
  stages: [
    { duration: '30s', target: 20 },
    { duration: '45s', target: 50 },
    { duration: '45s', target: 100 },
    { duration: '1m',  target: 200 },
    { duration: '1m',  target: 400 },
    { duration: '30s', target: 0 },
  ],

  thresholds: {
    http_req_failed: [
      { threshold: 'rate < 0.10', abortOnFail: true, delayAbortEval: '15s' },
    ],
    http_req_duration: [
      { threshold: 'p(95) < 3000', abortOnFail: false },
    ],
  },
};

export default function () {
  const params = {
    headers: {
      'User-Agent': 'k6-load-test/1.0',
      'Accept': 'application/json',
    },
    timeout: '15s',
  };

  const res = http.get(`${BASE_URL}/api/auth/session`, params);

  const isSuccess = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 3s': (r) => r.timings.duration < 3000,
  });

  failureRate.add(!isSuccess);
  responseTimeTrend.add(res.timings.duration);

  sleep(1);
}
