/**
 * 环境变量加载入口
 *
 * 固定从项目根目录加载 .env，避免因启动目录（如 IDE 的工作目录）不同而找不到配置。
 * 必须以副作用导入方式使用（import './load-env.js'），保证在其它模块读取
 * process.env 之前完成加载（ESM 会按 import 声明顺序执行副作用模块）。
 */
import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
config({ path: path.join(rootDir, '.env') });
