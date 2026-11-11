#!/usr/bin/env node
/**
 * 📘 scripts/bundle-baseline.mjs —— 可重复的客户端包体积基线
 *
 * 用法：
 *   1. npm run analyze        # 生成 .next/analyze/client.html（仅手动运行）
 *   2. node scripts/bundle-baseline.mjs [--top=15] [--path=admin]
 *
 * 直接读取分析报告里的 window.chartData（webpack stats 导出），输出：
 * - 客户端 chunk 的解析体积 / gzip 体积排行；
 * - 用 --path 过滤某段路径（如 admin、blog），便于确认大块属于哪个路由。
 *
 * 不重新构建：报告已经包含完整的 chunk 与模块映射，重复构建既慢，
 * 也会让「优化前后」的对比条件不一致。
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const reportFile = path.join(projectRoot, '.next', 'analyze', 'client.html');
const topArg = process.argv.find((arg) => arg.startsWith('--top='));
const top = Number(topArg?.split('=')[1] ?? 15);

if (!existsSync(reportFile)) {
  console.error('未找到 .next/analyze/client.html，请先运行：npm run analyze');
  process.exit(1);
}

const html = await readFile(reportFile, 'utf8');

/** 找到 window.chartData = [...] 并配平括号截取 JSON */
function extractChartData(source) {
  const marker = source.lastIndexOf('window.chartData =');
  if (marker < 0) throw new Error('报告中未找到 window.chartData');
  const start = source.indexOf('[', marker);
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) return JSON.parse(source.slice(start, i + 1));
    }
  }
  throw new Error('chartData JSON 未闭合');
}

const chartData = extractChartData(html);
const format = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;

const chunks = chartData
  .filter((entry) => entry.isAsset && (entry.gzipSize || entry.parsedSize))
  .map((entry) => ({
    label: entry.label,
    parsedSize: entry.parsedSize ?? 0,
    gzipSize: entry.gzipSize ?? 0,
  }))
  .sort((a, b) => b.gzipSize - a.gzipSize);

const totalGzip = chunks.reduce((sum, chunk) => sum + chunk.gzipSize, 0);
const totalParsed = chunks.reduce((sum, chunk) => sum + chunk.parsedSize, 0);

console.log('客户端包体积基线');
console.log(`chunk 数量：${String(chunks.length)}`);
console.log(`合计：${format(totalParsed)} parsed / ${format(totalGzip)} gzip`);
console.log('');
console.log(`Top ${String(top)} chunk（按 gzip）：`);
for (const chunk of chunks.slice(0, top)) {
  console.log(
    `- ${format(chunk.gzipSize).padStart(10)} gzip  ${format(chunk.parsedSize).padStart(10)} parsed  ${chunk.label}`,
  );
}

const pick = process.argv.find((arg) => arg.startsWith('--path='))?.slice('--path='.length);
if (pick) {
  const matched = chunks.filter((chunk) => chunk.label.includes(pick));
  if (matched.length === 0) console.log(`\n没有路径包含 "${pick}" 的 chunk`);
  else {
    console.log(`\n匹配 "${pick}"：${String(matched.length)} 个 chunk`);
    for (const chunk of matched.slice(0, top)) {
      console.log(`- ${format(chunk.gzipSize)} gzip  ${chunk.label}`);
    }
  }
}

const modulesOf = process.argv.find((arg) => arg.startsWith('--modules='))?.slice('--modules='.length);
if (modulesOf) {
  const entries = chartData.filter((entry) => entry.isAsset && entry.label.includes(modulesOf));
  /** 递归收集叶子模块（分析报告的 groups 是嵌套目录树） */
  const collect = (group, prefix = '') => {
    const label = prefix ? `${prefix}/${group.label}` : group.label;
    if (group.groups?.length) return group.groups.flatMap((child) => collect(child, label));
    if (!group.parsedSize) return [];
    return [{ label, parsedSize: group.parsedSize }];
  };
  const modules = entries
    .flatMap((entry) => collect(entry))
    .sort((a, b) => b.parsedSize - a.parsedSize);
  console.log(`\n${modulesOf} 内模块（按 parsed 体积）：`);
  for (const mod of modules.slice(0, top)) {
    console.log(`- ${format(mod.parsedSize).padStart(10)}  ${mod.label}`);
  }
}

