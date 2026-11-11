/**
 * 公开 API 延迟采样（性能基线用，只读）
 *
 * 用法：node scripts/api-bench.mjs [baseUrl] [durationSec]
 * 默认 http://127.0.0.1:4000，4 并发 keep-alive，每个接口持续压 3 秒，输出 p50/p95/p99。
 * 只请求 GET 公开接口，不写库、不登录。
 *
 * 注意：用 node:http + keepAlive 而不是 fetch。Windows 下 fetch 每次新连接会在
 * 高频轮询时耗尽临时端口（connectex 10048），既污染样本也会连带拖垮服务端建连。
 */
import http from 'node:http';
import { performance } from 'node:perf_hooks';

const base = process.argv[2] ?? 'http://127.0.0.1:4000';
const seconds = Number(process.argv[3] ?? 3);
const concurrency = 4;

const endpoints = [
  '/api/health',
  '/api/articles?page=1&pageSize=10',
  '/api/articles?page=2&pageSize=10',
  '/api/tags',
  '/api/site-content/plan',
  '/api/site-content/homeProjects',
];

const agent = new http.Agent({ keepAlive: true, maxSockets: concurrency, maxFreeSockets: concurrency });

function get(path) {
  const url = new URL(path, base);
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    const req = http.get(
      { hostname: url.hostname, port: url.port, path: url.pathname + url.search, agent },
      (res) => {
        res.resume();
        res.on('end', () => resolve({ ms: performance.now() - t0, status: res.statusCode ?? 0 }));
      },
    );
    req.on('error', reject);
    req.setTimeout(10_000, () => req.destroy(new Error('timeout')));
  });
}

async function sample(path) {
  const latencies = [];
  let errors = 0;
  const deadline = Date.now() + seconds * 1000;

  async function worker() {
    while (Date.now() < deadline) {
      try {
        const { ms, status } = await get(path);
        if (status >= 400) errors += 1;
        latencies.push(ms);
      } catch {
        errors += 1;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  latencies.sort((a, b) => a - b);
  const q = (p) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))] ?? 0;
  return {
    path,
    requests: latencies.length,
    errors,
    p50: Number(q(0.5).toFixed(1)),
    p95: Number(q(0.95).toFixed(1)),
    p99: Number(q(0.99).toFixed(1)),
  };
}

const rows = [];
for (const path of endpoints) {
  rows.push(await sample(path));
}
agent.destroy();
console.table(rows);
