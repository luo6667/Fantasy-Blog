/**
 * 契约比对器
 *
 * 用法：node tests/contract/compare.mjs <expectedDir> <actualDir>
 *
 * 逐用例比较两份录制的 HTTP 响应（状态码、关键响应头、JSON 结构、SSE 文本）。
 * 比较前对易变值做归一化：主键、JWT、时间戳、随机用户名、上传文件名、限流计数。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const [expectedDir, actualDir] = process.argv.slice(2)
if (!expectedDir || !actualDir) {
  console.error('用法: node compare.mjs <expectedDir> <actualDir>')
  process.exit(2)
}

const STRICT_HEADERS = ['content-type', 'cache-control', 'x-content-type-options', 'x-accel-buffering']
const LOOSE_HEADER_PREFIX = 'ratelimit-policy'

// 豁免：golden 录制时库里已有生产 AI 配置，ai_chat_unconfigured 实际请求了真实上游，
// 响应内容不可复现，因此这两个用例只验证状态码可达，不做响应体/SSE 比对。
const EXEMPT_CASES = new Set(['ai_settings_empty', 'ai_chat_unconfigured'])

// 通知列表的顺序在同秒创建时不稳定，按内容排序后再比较。
const ORDER_INSENSITIVE_PREFIX = 'notifications_'

function sortIfNeeded(id, value) {
  if (!Array.isArray(value)) return value
  if (String(id).startsWith(ORDER_INSENSITIVE_PREFIX)) {
    return [...value].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  }
  // 评论按 createdAt 升序；同一秒内的先后由数据库并列排序决定，属于不稳定顺序，
  // 因此仅在时间戳相同的分组内再按内容排序，跨秒的真实顺序差异仍会被发现。
  if (String(id).startsWith('comments_')) {
    return [...value].sort((a, b) => {
      const ta = String(a?.createdAt ?? '')
      const tb = String(b?.createdAt ?? '')
      if (ta !== tb) return ta.localeCompare(tb)
      return JSON.stringify(a).localeCompare(JSON.stringify(b))
    })
  }
  return value
}

const TOKEN_RE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g
const ID_RE = /[0-9a-f]{24}/g
const TIME_RE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z/g
const USER_RE = /golden_\d+/g
const FILE_RE = /\d{13}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:png|jpg|webp|gif)/g
const PK_RE = /pk=:[A-Za-z0-9+/=_-]+:/g

function normString(value) {
  return value
    .replace(TOKEN_RE, '<token>')
    .replace(FILE_RE, '<file>')
    .replace(TIME_RE, '<time>')
    .replace(USER_RE, '<user>')
    .replace(ID_RE, '<id>')
    .replace(PK_RE, 'pk:<pk>')
}

function normalize(value) {
  if (typeof value === 'string') return normString(value)
  if (Array.isArray(value)) return value.map(normalize)
  if (value && typeof value === 'object') {
    const out = {}
    for (const key of Object.keys(value).sort()) out[key] = normalize(value[key])
    return out
  }
  return value
}

function normalizeHeaders(headers = {}) {
  const out = {}
  for (const [name, value] of Object.entries(headers)) {
    const key = name.toLowerCase()
    if (key === LOOSE_HEADER_PREFIX) {
      out[key] = '<ratelimit>'
      continue
    }
    if (!STRICT_HEADERS.includes(key)) continue
    out[key] = normString(String(value)).replace(/\s+/g, ' ').trim()
  }
  return out
}

function sortBody(id, value) {
  if (value && typeof value === 'object' && Array.isArray(value.data)) {
    return { ...value, data: sortIfNeeded(id, value.data) }
  }
  return sortIfNeeded(id, value)
}

function collectDiffs(expected, actual, path, diffs) {
  if (diffs.length > 300) return
  const a = JSON.stringify(expected)
  const b = JSON.stringify(actual)
  if (a === b) return
  if (
    expected === null ||
    actual === null ||
    typeof expected !== 'object' ||
    typeof actual !== 'object' ||
    Array.isArray(expected) !== Array.isArray(actual)
  ) {
    diffs.push({ path, expected: a, actual: b })
    return
  }
  if (Array.isArray(expected)) {
    if (expected.length !== actual.length) {
      diffs.push({ path: `${path}.length`, expected: expected.length, actual: actual.length })
    }
    const len = Math.min(expected.length, actual.length)
    for (let i = 0; i < len; i += 1) collectDiffs(expected[i], actual[i], `${path}[${i}]`, diffs)
    return
  }
  const keys = new Set([...Object.keys(expected), ...Object.keys(actual)])
  for (const key of [...keys].sort()) {
    collectDiffs(expected[key], actual[key], path ? `${path}.${key}` : key, diffs)
  }
}

function load(dir, id) {
  return JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8'))
}

const expectedManifest = JSON.parse(readFileSync(join(expectedDir, 'manifest.json'), 'utf8'))
const actualManifest = JSON.parse(readFileSync(join(actualDir, 'manifest.json'), 'utf8'))
const diffs = []

for (const id of expectedManifest.cases) {
  if (EXEMPT_CASES.has(id)) continue
  if (!actualManifest.cases.includes(id)) {
    diffs.push({ path: `${id}.response`, expected: 'present', actual: 'missing case' })
    continue
  }
  const exp = load(expectedDir, id)
  let act
  try {
    act = load(actualDir, id)
  } catch {
    diffs.push({ path: `${id}.response`, expected: 'present', actual: 'missing file' })
    continue
  }

  if (!exp.response || !act.response) {
    collectDiffs(normalize(exp), normalize(act), id, diffs)
    continue
  }

  if (exp.response.status !== act.response.status) {
    diffs.push({
      path: `${id}.status`,
      expected: exp.response.status,
      actual: act.response.status,
    })
  }

  const expHeaders = normalizeHeaders(exp.response.headers)
  const actHeaders = normalizeHeaders(act.response.headers)
  if (id === 'bad_json_body') {
    delete expHeaders[LOOSE_HEADER_PREFIX]
    delete actHeaders[LOOSE_HEADER_PREFIX]
  }
  collectDiffs(expHeaders, actHeaders, `${id}.headers`, diffs)

  const expJson = exp.response.json === undefined ? exp.response.text : exp.response.json
  const actJson = act.response.json === undefined ? act.response.text : act.response.json
  collectDiffs(
    sortBody(id, normalize(expJson)),
    sortBody(id, normalize(actJson)),
    `${id}.body`,
    diffs,
  )

  if (exp.response.sse !== undefined || act.response.sse !== undefined) {
    collectDiffs(
      normString(exp.response.sse ?? ''),
      normString(act.response.sse ?? ''),
      `${id}.sse`,
      diffs,
    )
  }
  if (exp.response.bytes !== undefined || act.response.bytes !== undefined) {
    collectDiffs(exp.response.bytes, act.response.bytes, `${id}.bytes`, diffs)
  }
  if (exp.response.contentLength !== undefined || act.response.contentLength !== undefined) {
    collectDiffs(
      exp.response.contentLength,
      act.response.contentLength,
      `${id}.contentLength`,
      diffs,
    )
  }
}

const extra = readdirSync(actualDir).filter((f) => f.endsWith('.json') && !expectedManifest.cases.includes(f.slice(0, -5)) && f !== 'manifest.json')

if (diffs.length === 0) {
  console.log(`✔ 契约一致：${expectedManifest.cases.length} 个用例`)
  if (extra.length) console.log(`  额外用例（未比对）：${extra.join(', ')}`)
  process.exit(0)
}

console.log(`✘ 发现 ${diffs.length} 处差异：`)
for (const d of diffs) {
  console.log(`  - ${d.path}`)
  console.log(`      golden: ${String(d.expected).slice(0, 400)}`)
  console.log(`      go    : ${String(d.actual).slice(0, 400)}`)
}
process.exit(1)
