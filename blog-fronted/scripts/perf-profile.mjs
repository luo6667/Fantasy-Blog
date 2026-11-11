/**
 * 滚动卡顿采样脚本（性能优化前后对比用）
 *
 * 用法：
 *   node scripts/perf-profile.mjs --url=http://localhost:3100/home --out=../perf-baseline/profile-home-before.json
 *   可选 --mobile=1 模拟 390x844 + CPU 4x 降速
 *
 * 做的事：
 * 1. 打开页面并等待首屏稳定；
 * 2. 注入 PerformanceObserver 记录 long task；
 * 3. 用 rAF 在 4s 内从顶部平滑滚到页面底部，记录每帧间隔；
 * 4. 输出 long task 数量/总阻塞、帧间隔 p50/p95、掉帧比例与网络请求统计。
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import puppeteer from 'puppeteer-core';

function arg(name, fallback = '') {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const url = arg('url');
const out = arg('out');
const mobile = arg('mobile') === '1';
const chromePath =
  process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

if (!url || !out) {
  console.error('usage: node scripts/perf-profile.mjs --url=<url> --out=<file> [--mobile=1]');
  process.exit(1);
}

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});

try {
  const page = await browser.newPage();
  await page.setViewport(mobile ? { width: 390, height: 844, deviceScaleFactor: 2 } : { width: 1280, height: 800 });
  if (mobile) {
    const cdp = await page.createCDPSession();
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }

  const requests = [];
  page.on('requestfinished', (req) => {
    const u = req.url();
    if (u.includes('/api/') || /\.(mp4|jpg|png|webp|avif)$/.test(u)) {
      requests.push({ url: u.slice(0, 160), type: req.resourceType() });
    }
  });

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 });
  await new Promise((r) => setTimeout(r, 1200));

  const result = await page.evaluate(async () => {
    /** @type {{d:number}[]} */
    const longTasks = [];
    const obs = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) longTasks.push({ d: e.duration, start: e.startTime });
    });
    try {
      obs.observe({ type: 'longtask', buffered: true });
    } catch {
      /* 浏览器不支持 longtask */
    }

    const frames = [];
    let last = performance.now();
    const startY = window.scrollY;
    const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const duration = 4000;
    const t0 = performance.now();

    await new Promise((resolve) => {
      const step = () => {
        const now = performance.now();
        frames.push(now - last);
        last = now;
        const p = Math.min(1, (now - t0) / duration);
        window.scrollTo(0, startY + (maxY - startY) * p);
        if (p < 1) requestAnimationFrame(step);
        else resolve(null);
      };
      requestAnimationFrame(step);
    });

    obs.disconnect();

    const sorted = [...frames].sort((a, b) => a - b);
    const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
    const lt = longTasks.filter((t) => t.start > t0 - 500);
    const totalBlocking = lt.reduce((s, t) => s + Math.max(0, t.d - 50), 0);

    return {
      scrollHeight: maxY,
      frames: frames.length,
      frameP50: Number(q(0.5).toFixed(1)),
      frameP95: Number(q(0.95).toFixed(1)),
      frameMax: Number((sorted[sorted.length - 1] ?? 0).toFixed(1)),
      framesOver25ms: frames.filter((f) => f > 25).length,
      framesOver50ms: frames.filter((f) => f > 50).length,
      longTaskCount: lt.length,
      longTaskTotalMs: Number(lt.reduce((s, t) => s + t.d, 0).toFixed(0)),
      totalBlockingMs: Number(totalBlocking.toFixed(0)),
      maxLongTaskMs: Number((lt.reduce((m, t) => Math.max(m, t.d), 0)).toFixed(0)),
    };
  });

  const totalRequests = requests.length;
  const apiRequests = requests.filter((r) => r.url.includes('/api/'));
  const report = {
    url,
    mobile,
    at: new Date().toISOString(),
    ...result,
    requestCount: totalRequests,
    apiRequestCount: apiRequests.length,
    apiRequests: apiRequests.map((r) => r.url),
    mediaRequests: requests.filter((r) => !r.url.includes('/api/')).map((r) => r.url),
  };

  writeFileSync(resolve(out), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
