/**
 * 路由切换计时（开发辅助，不属于构建/发布流程）
 *
 * 用法：
 *   node scripts/nav-timing.mjs                 # 默认测 http://localhost:3000
 *   NAV_BASE=http://localhost:3300 node scripts/nav-timing.mjs
 *
 * 输出每次点击「导航 → URL 变化」「导航 → 新页 h1 可见」的耗时，
 * 用于验证首屏动画/路由骨架改动是否真的减少了空白等待。
 */
import puppeteer from 'puppeteer-core';

const BASE = process.env.NAV_BASE ?? 'http://localhost:3000';
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-first-run', '--disable-breakpad'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${BASE}/home`, { waitUntil: 'networkidle2', timeout: 90_000 });
  await new Promise((resolve) => setTimeout(resolve, 800));

  const rows = [];
  for (const label of ['博客', '规划', '简历', '关于', '首页']) {
    const started = Date.now();
    const handle = await page.evaluateHandle(
      (text) =>
        [...document.querySelectorAll('header a')].find((a) => a.textContent.trim() === text) ??
        null,
      label,
    );
    const link = handle.asElement();
    if (!link) {
      rows.push({ label, error: 'link not found' });
      continue;
    }
    const before = await page.evaluate(() => location.pathname);
    await link.click();
    await page
      .waitForFunction((previous) => location.pathname !== previous, { timeout: 15_000 }, before)
      .catch(() => {});
    const pathMs = Date.now() - started;

    await page
      .waitForFunction(
        () => {
          const heading = document.querySelector('h1');
          if (!heading) return false;
          const style = getComputedStyle(heading);
          return heading.textContent.trim().length > 0 && Number(style.opacity) > 0.98;
        },
        { timeout: 15_000 },
      )
      .catch(() => {});
    rows.push({ label, pathMs, visibleMs: Date.now() - started });
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  const measure = (key) => {
    const values = rows.filter((row) => typeof row[key] === 'number').map((row) => row[key]);
    if (values.length === 0) return 'n/a';
    values.sort((a, b) => a - b);
    return `${values[Math.floor(values.length / 2)]}ms (max ${values.at(-1)}ms)`;
  };

  console.table(rows);
  console.log(`path change p50: ${measure('pathMs')}`);
  console.log(`h1 visible p50:  ${measure('visibleMs')}`);
} finally {
  await browser.close();
}
