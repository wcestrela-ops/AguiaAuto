#!/usr/bin/env node
/**
 * Teste de carga leve — AguiaAuto API
 *
 * Uso:
 *   node scripts/load-test.js
 *   node scripts/load-test.js --url http://localhost:3000 --duration 15 --concurrency 10
 */
const { performance } = require('perf_hooks');

function parseArgs(argv) {
  const opts = {
    url: process.env.LOAD_TEST_URL || 'http://localhost:3000',
    duration: 10,
    concurrency: 5,
  };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--url') opts.url = argv[++i];
    else if (argv[i] === '--duration') opts.duration = Number(argv[++i]);
    else if (argv[i] === '--concurrency') opts.concurrency = Number(argv[++i]);
  }
  return opts;
}

const ENDPOINTS = [
  { path: '/health/live', weight: 3 },
  { path: '/health/ready', weight: 2 },
  { path: '/v1/plans', weight: 1 },
  { path: '/v1/openapi.json', weight: 1 },
];

function pickEndpoint() {
  const total = ENDPOINTS.reduce((sum, e) => sum + e.weight, 0);
  let r = Math.random() * total;
  for (const ep of ENDPOINTS) {
    r -= ep.weight;
    if (r <= 0) return ep.path;
  }
  return ENDPOINTS[0].path;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function runWorker(baseUrl, deadline, stats) {
  while (performance.now() < deadline) {
    const path = pickEndpoint();
    const url = `${baseUrl.replace(/\/$/, '')}${path}`;
    const start = performance.now();
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      const ms = performance.now() - start;
      stats.latencies.push(ms);
      stats.total += 1;
      if (res.ok) stats.ok += 1;
      else stats.errors += 1;
    } catch {
      stats.latencies.push(performance.now() - start);
      stats.total += 1;
      stats.errors += 1;
    }
  }
}

async function main() {
  const opts = parseArgs(process.argv);
  const deadline = performance.now() + opts.duration * 1000;
  const stats = { total: 0, ok: 0, errors: 0, latencies: [] };

  console.log('=== AguiaAuto Load Test ===');
  console.log(`URL: ${opts.url}`);
  console.log(`Duration: ${opts.duration}s | Concurrency: ${opts.concurrency}`);
  console.log(`Endpoints: ${ENDPOINTS.map((e) => e.path).join(', ')}`);
  console.log();

  const workers = Array.from({ length: opts.concurrency }, () =>
    runWorker(opts.url, deadline, stats),
  );
  await Promise.all(workers);

  const sorted = stats.latencies.sort((a, b) => a - b);
  const rps = stats.total / opts.duration;

  console.log('--- Resultados ---');
  console.log(`Requisições: ${stats.total}`);
  console.log(`Sucesso:     ${stats.ok} (${((stats.ok / Math.max(stats.total, 1)) * 100).toFixed(1)}%)`);
  console.log(`Erros:       ${stats.errors}`);
  console.log(`RPS:         ${rps.toFixed(1)}`);
  console.log(`Latência ms: p50=${percentile(sorted, 50).toFixed(1)} p95=${percentile(sorted, 95).toFixed(1)} p99=${percentile(sorted, 99).toFixed(1)} max=${(sorted[sorted.length - 1] || 0).toFixed(1)}`);

  if (stats.errors / Math.max(stats.total, 1) > 0.05) {
    process.exitCode = 1;
    console.log('\n⚠️  Taxa de erro acima de 5%');
  } else {
    console.log('\n✅ Teste concluído');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
