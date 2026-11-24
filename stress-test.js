import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const failureRate = new Rate('failed_requests');
const responseTimeTrend = new Trend('custom_req_duration');

// Konfigurasi Target URL (DEFAULT KE LOKAL agar kuota Vercel aman)
const BASE_URL = __ENV.TARGET_URL || 'http://localhost:3000';

export const options = {
  // Skenario bertahap mencari batas kapasitas server lokal Anda
  stages: [
    { duration: '30s', target: 50 },   // Warm up ke 50 VUs
    { duration: '1m',  target: 150 },  // Naik ke 150 VUs
    { duration: '1m',  target: 300 },  // Naik ke 300 VUs
    { duration: '1m',  target: 600 },  // Naik ke 600 VUs
    { duration: '1m',  target: 1000 }, // Push ke 1.000 VUs (Mencari peak hardware lokal)
    { duration: '30s', target: 0 },    // Cooldown
  ],

  thresholds: {
    // Jika kegagalan > 10%, k6 otomatis berhenti
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
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    timeout: '10s',
  };

  const res = http.get(`${BASE_URL}/`, params);

  const isSuccess = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 3s': (r) => r.timings.duration < 3000,
  });

  failureRate.add(!isSuccess);
  responseTimeTrend.add(res.timings.duration);

  // Think time 1 detik antar request
  sleep(1);
}
