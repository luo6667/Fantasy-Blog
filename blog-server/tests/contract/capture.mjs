/**
 * 契约录制器（任务 1）
 *
 * 对「旧 Node 实现」发真实请求并把响应冻结成 golden 夹具，作为 Go 重写后的
 * 兼容性基线。录制只写入副本库 blog_golden，不碰 jianli，不修改 blog-server/.env。
 *
 * 用法：
 *   1. 副本库 + 旧服务（端口 4001）已就绪，见 tests/contract/README.md
 *   2. node tests/contract/capture.mjs
 * 产物：tests/contract/golden/manifest.json + 每个用例一个 <id>.json
 */
import { createServer } from 'node:http'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = process.env.GOLDEN_BASE ?? 'http://127.0.0.1:4001'
const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = process.env.GOLDEN_OUT ? resolve(process.env.GOLDEN_OUT) : join(HERE, 'golden')

const results = []
let userToken = ''
let adminToken = ''
let articleId = ''
let commentId = ''
let newArticleId = ''

const PKG = { username: `golden_${Date.now() % 100000}`, password: 'User@12345' }

/** 只保留对兼容性有意义、且稳定的响应头 */
const KEEP_HEADERS = [
  'content-type',
  'cache-control',
  'x-content-type-options',
  'x-accel-buffering',
  'ratelimit-policy',
  'ratelimit-limit',
  'ratelimit-remaining',
  'ratelimit-reset',
]

function pickHeaders(res) {
  const out = {}
  for (const name of KEEP_HEADERS) {
    const value = res.headers.get(name)
    if (value !== null) out[name] = value
  }
  return out
}

async function call(id, method, path, { token, body, headers, form } = {}) {
  const init = { method, headers: { ...headers } }
  if (token) init.headers.Authorization = `Bearer ${token}`
  if (form) {
    init.body = form
  } else if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json'
    init.body = typeof body === 'string' ? body : JSON.stringify(body)
  }
  const res = await fetch(BASE + path, init)
  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = undefined
  }
  const record = {
    id,
    request: { method, path, auth: token === adminToken && adminToken ? 'admin' : token ? 'user' : 'none', body: form ? '<multipart>' : body },
    response: { status: res.status, headers: pickHeaders(res), json, text: json === undefined ? text : undefined },
  }
  results.push(record)
  return { status: res.status, json, text }
}

function png1x1() {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )
}

async function upload(token, filename, bytes, type) {
  const form = new FormData()
  form.append('image', new Blob([bytes], { type }), filename)
  return call('upload_' + filename.replace(/\W+/g, '_'), 'POST', '/api/upload', { token, form })
}

/** 模拟 OpenAI 兼容上游：/v1/chat/completions 正常流，/err/chat/completions 500 */
function startFakeUpstream() {
  const server = createServer((req, res) => {
    if (req.url === '/v1/chat/completions') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' })
      res.write('data: {"id":"c1","choices":[{"delta":{"content":"你"}}]}\n\n')
      res.write('data: {"id":"c1","choices":[{"delta":{"content":"好"}}]}\n\n')
      res.write('data: [DONE]\n\n')
      res.end()
      return
    }
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end('{"error":"upstream exploded"}')
  })
  return new Promise((resolve) => server.listen(4009, '127.0.0.1', () => resolve(server)))
}

async function main() {
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })

  // ---------- 只读：公开接口 ----------
  await call('health', 'GET', '/api/health')
  const list = await call('articles_page1', 'GET', '/api/articles')
  await call('articles_page2', 'GET', '/api/articles?page=2&pageSize=3')
  await call('articles_clamped', 'GET', '/api/articles?page=0&pageSize=999')
  await call('articles_by_tag', 'GET', '/api/articles?tag=' + encodeURIComponent('React'))
  await call('articles_by_search', 'GET', '/api/articles?search=' + encodeURIComponent('React'))
  await call('articles_empty_search', 'GET', '/api/articles?search=' + encodeURIComponent('zzz-no-such'))
  await call('article_tags', 'GET', '/api/articles/tags')
  await call('tags_library', 'GET', '/api/tags')

  articleId = list.json?.data?.list?.[0]?.id ?? ''
  await call('article_detail', 'GET', `/api/articles/${articleId}`)
  await call('article_detail_404', 'GET', '/api/articles/ffffffffffffffffffffffff')
  await call('article_comments', 'GET', `/api/articles/${articleId}/comments`)

  // ---------- 只读：站点内容 ----------
  await call('site_content_education', 'GET', '/api/site-content/education')
  await call('site_content_plan_seed', 'GET', '/api/site-content/plan')
  await call('site_content_unknown', 'GET', '/api/site-content/nope')

  // ---------- 认证 ----------
  await call('register_ok', 'POST', '/api/auth/register', { body: PKG })
  await call('register_duplicate', 'POST', '/api/auth/register', { body: PKG })
  await call('register_short_password', 'POST', '/api/auth/register', {
    body: { username: 'golden_short', password: '123' },
  })
  await call('register_short_username', 'POST', '/api/auth/register', {
    body: { username: 'a', password: 'User@12345' },
  })

  const loginUser = await call('login_user_ok', 'POST', '/api/auth/login', { body: PKG })
  userToken = loginUser.json?.data?.token ?? ''
  const loginAdmin = await call('login_admin_ok', 'POST', '/api/auth/login', {
    body: { username: 'admin', password: 'Admin@12345', role: 'admin' },
  })
  adminToken = loginAdmin.json?.data?.token ?? ''
  await call('login_user_bad_password', 'POST', '/api/auth/login', {
    body: { username: PKG.username, password: 'wrong-password' },
  })
  await call('login_admin_bad_password', 'POST', '/api/auth/login', {
    body: { username: 'admin', password: 'wrong-password', role: 'admin' },
  })
  await call('login_validation_missing', 'POST', '/api/auth/login', { body: {} })
  await call('login_user_as_admin_role', 'POST', '/api/auth/login', {
    body: { username: PKG.username, password: PKG.password, role: 'admin' },
  })

  await call('me_user', 'GET', '/api/auth/me', { token: userToken })
  await call('me_admin', 'GET', '/api/auth/me', { token: adminToken })
  await call('me_without_token', 'GET', '/api/auth/me')
  await call('me_bad_token', 'GET', '/api/auth/me', { token: 'not-a-jwt' })

  // ---------- 权限 ----------
  await call('users_manage_admin', 'GET', '/api/users/manage', { token: adminToken })
  await call('users_manage_forbidden', 'GET', '/api/users/manage', { token: userToken })
  await call('site_content_list_admin', 'GET', '/api/site-content', { token: adminToken })
  await call('site_content_list_forbidden', 'GET', '/api/site-content', { token: userToken })

  // ---------- 通知 ----------
  await call('notifications_list', 'GET', '/api/notifications', { token: userToken })
  await call('notifications_unread', 'GET', '/api/notifications/unread-count', { token: userToken })
  await call('notifications_mark_all', 'POST', '/api/notifications/read', { token: userToken, body: {} })
  await call('notifications_mark_too_many', 'POST', '/api/notifications/read', {
    token: userToken,
    body: { ids: Array.from({ length: 101 }, (_, i) => 'x' + i) },
  })

  // ---------- 文章写 ----------
  const created = await call('article_create', 'POST', '/api/articles', {
    token: adminToken,
    body: {
      title: 'Golden 契约文章',
      excerpt: '用于契约录制的临时文章',
      content: '# 标题\n\n正文 **加粗** 与 `code`。\n\n- a\n- b\n',
      tags: ['MySQL'],
      cover: '',
    },
  })
  newArticleId = created.json?.data?.id ?? ''
  await call('article_create_invalid', 'POST', '/api/articles', {
    token: adminToken,
    body: { title: '', excerpt: '', content: '', tags: [] },
  })
  await call('article_create_bad_cover', 'POST', '/api/articles', {
    token: adminToken,
    body: {
      title: 'cover test',
      excerpt: 'cover test',
      content: 'x',
      tags: ['MySQL'],
      cover: 'ftp://nope',
    },
  })
  await call('article_create_forbidden', 'POST', '/api/articles', {
    token: userToken,
    body: { title: 'x', excerpt: 'x', content: 'x', tags: ['MySQL'] },
  })
  await call('article_update', 'PUT', `/api/articles/${newArticleId}`, {
    token: adminToken,
    body: { title: 'Golden 契约文章（改）' },
  })
  await call('article_detail_after_create', 'GET', `/api/articles/${newArticleId}`)

  // ---------- 点赞 ----------
  await call('article_like', 'POST', `/api/articles/${newArticleId}/like`, { token: userToken })
  await call('article_detail_as_liker', 'GET', `/api/articles/${newArticleId}`, { token: userToken })
  await call('article_like_twice', 'POST', `/api/articles/${newArticleId}/like`, { token: userToken })
  await call('article_like_404', 'POST', '/api/articles/ffffffffffffffffffffffff/like', {
    token: userToken,
  })

  // ---------- 评论 ----------
  const comment = await call('comment_create', 'POST', `/api/articles/${newArticleId}/comments`, {
    token: userToken,
    body: { content: '契约评论' },
  })
  commentId = comment.json?.data?.id ?? ''
  await call('comment_create_invalid', 'POST', `/api/articles/${newArticleId}/comments`, {
    token: userToken,
    body: { content: '   ' },
  })
  await call('comments_after_create', 'GET', `/api/articles/${newArticleId}/comments`)
  await call('comment_reply', 'POST', `/api/comments/${commentId}/replies`, {
    token: adminToken,
    body: { content: '管理员回复' },
  })
  await call('comment_like', 'POST', `/api/comments/${commentId}/like`, { token: userToken })
  await call('comment_like_twice', 'POST', `/api/comments/${commentId}/like`, { token: userToken })
  await call('comments_after_reply', 'GET', `/api/articles/${newArticleId}/comments`)
  await call('notifications_admin_after_comment', 'GET', '/api/notifications', { token: adminToken })
  await call('notifications_user_after_reply', 'GET', '/api/notifications', { token: userToken })
  await call('notifications_user_unread_after', 'GET', '/api/notifications/unread-count', {
    token: userToken,
  })
  await call('notifications_mark_read_ids', 'POST', '/api/notifications/read', {
    token: userToken,
    body: { ids: [] },
  })
  const ownComment = await call(
    'comment_create_for_delete',
    'POST',
    `/api/articles/${newArticleId}/comments`,
    { token: userToken, body: { content: '待删除的评论' } },
  )
  const ownCommentId = ownComment.json?.data?.id ?? ''
  await call('comment_delete_own', 'DELETE', `/api/comments/${ownCommentId}`, { token: userToken })
  await call('comment_delete_404', 'DELETE', '/api/comments/ffffffffffffffffffffffff', {
    token: adminToken,
  })

  // ---------- 标签写 ----------
  await call('tag_create', 'POST', '/api/tags', { token: adminToken, body: { name: 'Golden Tag' } })
  await call('tag_create_duplicate', 'POST', '/api/tags', { token: adminToken, body: { name: 'MySQL' } })
  await call('tag_create_forbidden', 'POST', '/api/tags', { token: userToken, body: { name: 'X' } })
  await call('tag_delete', 'DELETE', '/api/tags/' + encodeURIComponent('GoldenTag'), {
    token: adminToken,
  })
  await call('tag_delete_404', 'DELETE', '/api/tags/nope-tag', { token: adminToken })

  // ---------- 上传 ----------
  const tiny = await upload(adminToken, 'tiny.png', png1x1(), 'image/png')
  const tinyFile = tiny.json?.data?.filename ?? ''
  if (tinyFile) {
    const raw = await fetch(`${BASE}/uploads/${tinyFile}`)
    results.push({
      id: 'uploads_static_get',
      request: { method: 'GET', path: `/uploads/${tinyFile}`, auth: 'none' },
      response: {
        status: raw.status,
        headers: pickHeaders(raw),
        contentLength: raw.headers.get('content-length'),
        bytes: (await raw.arrayBuffer()).byteLength,
      },
    })
  }
  await upload(adminToken, 'fake.png', Buffer.from('GIF89a-not-a-png'), 'image/png')
  await upload(adminToken, 'not-image.txt', Buffer.from('hello world'), 'text/plain')
  await upload(adminToken, 'too-big.png', Buffer.alloc(6 * 1024 * 1024, 1), 'image/png')
  await upload(userToken, 'forbidden.png', png1x1(), 'image/png')

  // ---------- 站点内容写 ----------
  await call('site_content_update_ok', 'PUT', '/api/site-content/evaluation', {
    token: adminToken,
    body: { value: '契约录制写入的简介\n第二行' },
  })
  await call('site_content_update_invalid', 'PUT', '/api/site-content/evaluation', {
    token: adminToken,
    body: { value: '' },
  })
  await call('site_content_update_unknown', 'PUT', '/api/site-content/nope', {
    token: adminToken,
    body: { value: 'x' },
  })

  // ---------- 错误处理 ----------
  await call('route_not_found', 'GET', '/api/nope')
  await call('bad_json_body', 'POST', '/api/auth/login', {
    body: '{"username": ',
    headers: { 'Content-Type': 'application/json' },
  })
  await call('method_not_allowed', 'PATCH', '/api/articles')

  // ---------- AI 配置 + SSE ----------
  const fake = await startFakeUpstream()
  try {
    await call('ai_settings_empty', 'GET', '/api/ai/settings', { token: adminToken })
    await call('ai_settings_forbidden', 'GET', '/api/ai/settings', { token: userToken })
    await call('ai_chat_unconfigured', 'POST', '/api/ai/chat', {
      token: userToken,
      body: { messages: [{ role: 'user', content: 'hi' }] },
    })
    await call('ai_settings_save', 'PUT', '/api/ai/settings', {
      token: adminToken,
      body: { baseURL: 'http://127.0.0.1:4009/v1', apiKey: 'sk-golden', model: 'golden-model' },
    })
    await call('ai_settings_after_save', 'GET', '/api/ai/settings', { token: adminToken })
    const chat = await call('ai_chat_sse', 'POST', '/api/ai/chat', {
      token: userToken,
      body: { messages: [{ role: 'user', content: 'hi' }] },
    })
    results[results.length - 1].response.sse = chat.text
    await call('ai_chat_validation', 'POST', '/api/ai/chat', {
      token: userToken,
      body: { messages: [] },
    })
    await call('ai_settings_save_bad_upstream', 'PUT', '/api/ai/settings', {
      token: adminToken,
      body: { baseURL: 'http://127.0.0.1:4009/err', apiKey: 'sk-golden', model: 'golden-model' },
    })
    const errChat = await call('ai_chat_upstream_error', 'POST', '/api/ai/chat', {
      token: userToken,
      body: { messages: [{ role: 'user', content: 'hi' }] },
    })
    results[results.length - 1].response.sse = errChat.text
  } finally {
    fake.close()
  }

  // ---------- 清理 ----------
  await call('article_delete', 'DELETE', `/api/articles/${newArticleId}`, { token: adminToken })
  await call('article_detail_after_delete', 'GET', `/api/articles/${newArticleId}`)

  // ---------- 限流（放最后，会污染 auth 限流窗口 15 分钟） ----------
  const burst = []
  for (let i = 0; i < 25; i += 1) {
    const res = await call(`rate_limit_${i + 1}`, 'POST', '/api/auth/login', {
      body: { username: 'nobody', password: 'wrong-password' },
    })
    burst.push(res.status)
    if (res.status === 429) break
  }
  results.push({ id: 'rate_limit_summary', burst })

  const manifest = {
    base: BASE,
    capturedAt: new Date().toISOString(),
    account: { username: PKG.username },
    cases: results.map((r) => r.id),
  }
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2))
  for (const record of results) {
    writeFileSync(join(OUT, `${record.id}.json`), JSON.stringify(record, null, 2))
  }
  console.log(`✔ 录制 ${results.length} 个用例 → ${OUT}`)
}

main().catch((err) => {
  console.error('录制失败:', err)
  process.exit(1)
})
