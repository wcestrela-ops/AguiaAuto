#!/usr/bin/env node
/**
 * k6 — smoke autenticado (cliente)
 *
 * Pré-requisito: k6 instalado (https://k6.io/docs/get-started/installation/)
 *
 * Uso:
 *   k6 run scripts/k6/auth-smoke.js
 *   k6 run -e BASE_URL=http://localhost:3000 -e CLIENT_EMAIL=... -e CLIENT_PASSWORD=... scripts/k6/auth-smoke.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: Number(__ENV.VUS || 3),
  duration: __ENV.DURATION || '30s',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<800'],
  },
};

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const CLIENT_EMAIL = __ENV.CLIENT_EMAIL || '';
const CLIENT_PASSWORD = __ENV.CLIENT_PASSWORD || '';

export function setup() {
  if (!CLIENT_EMAIL || !CLIENT_PASSWORD) {
    return { token: null, skipAuth: true };
  }

  const loginRes = http.post(
    `${BASE_URL}/v1/auth/login`,
    JSON.stringify({ email: CLIENT_EMAIL, password: CLIENT_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  check(loginRes, {
    'login status 200': (r) => r.status === 200,
  });

  const body = loginRes.json();
  return {
    token: body?.data?.access_token || null,
    skipAuth: false,
  };
}

export default function (data) {
  const headers = { 'Content-Type': 'application/json' };
  if (data.token) {
    headers.Authorization = `Bearer ${data.token}`;
  }

  const live = http.get(`${BASE_URL}/health/live`);
  check(live, { 'health/live 200': (r) => r.status === 200 });

  if (data.token) {
    const dashboard = http.get(`${BASE_URL}/v1/dashboard`, { headers });
    check(dashboard, {
      'dashboard ok': (r) => r.status === 200 || r.status === 403,
    });

    const veiculos = http.get(`${BASE_URL}/v1/veiculos`, { headers });
    check(veiculos, {
      'veiculos ok': (r) => r.status === 200 || r.status === 403,
    });
  } else if (!data.skipAuth) {
    check(null, { 'token ausente após login': () => false });
  }

  sleep(0.3);
}
