# 契约回放（Node → Go）

`blog-server` 的目标是**对外行为与旧 Node 实现完全一致**。为了证明这一点，
这里保留了旧服务真实录制的响应作为 golden，并用同一份采集脚本对 Go 实现重放。

## 工作方式

1. **录制（已完成，通常无需重跑）**
   旧 Node 服务连接 `blog_golden` 副本库启动在 `:4001`，运行
   `GOLDEN_BASE=http://127.0.0.1:4001 node tests/contract/capture.mjs`，
   把 101 个用例写入 `tests/contract/golden/`。

   录制用的数据集已固化为 `tests/contract/fixture.sql`（含管理员种子之外的业务数据，
   以及录制所需的 `MySQL` 标签），回放不再依赖 `jianli`，因此本地数据变动不会让基线漂移。
   Node 后端归档/删除后，golden 与 fixture 即是唯一的契约来源，不要再重录。

2. **回放与比对（一键）**
   ```bash
   cd blog-server
   bash tests/contract/replay.sh
   ```
   脚本会：用 `fixture.sql` 重建 `blog_golden` → 种入管理员 → 清空通知 → 编译 Go →
   启动 `:4100` → 用同一份 `capture.mjs` 采集到 `tests/contract/actual/` →
   `compare.mjs` 归一化后逐用例比较。成功输出 `✔ 契约一致：101 个用例`。

3. **只重跑比对**
   ```bash
   node tests/contract/compare.mjs tests/contract/golden tests/contract/actual
   ```

## 归一化规则（compare.mjs）

比较前会抹平与实现无关的易变值，避免假阳性：

- JWT、24 位十六进制主键、ISO 时间戳；
- 随机用户名 `golden_<n>`、上传文件名（毫秒 + UUID）；
- `ratelimit-policy` 头只校验存在与格式占位，`ratelimit-limit/remaining/reset` 忽略；
- `bad_json_body` 不比较 `ratelimit-policy`（旧实现由 body-parser 在限流前拒绝，本就不带该头）。

## 已知豁免（书面豁免，非缺陷）

| 用例 | 原因 |
| --- | --- |
| `ai_settings_empty` | golden 录制时库里已有生产 AI 配置，`data` 不是空视图；Go 回放使用重置后的空配置库。 |
| `ai_chat_unconfigured` | 同上：录制时已配置真实上游，该用例实际拿到了上游 SSE，无法确定性复现。 |

另有两类顺序不稳定但内容一致的用例，在比较时做了顺序归一：

- 通知列表：同一秒内创建的多条通知，`ORDER BY createdAt DESC` 的并列顺序由数据库决定；
- 评论列表：按 `createdAt` 分级，同一秒内的先后按内容排序后再比较，跨秒顺序差异仍会被发现。

## 数据与安全

- 只用副本库 `blog_golden`，脚本不会连接或修改 `jianli`；
- 上传文件落盘在 `testdata/uploads/`（已 gitignore）；
- golden 中不含真实密钥：AI 用例使用假上游 `127.0.0.1:4009` 与假 key `sk-golden`。

## 相关文件

- `capture.mjs`：请求编排与 golden 落盘（`GOLDEN_OUT` 可指定输出目录）；
- `compare.mjs`：归一化、深比较、差异报告；
- `replay.sh`：从空库到比对结果的一键脚本；
- `golden/`：101 个 Node 基线用例；
- `actual/`：最近一次 Go 回放结果（可重新生成）。
