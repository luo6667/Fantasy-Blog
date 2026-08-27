import { useRef, useState } from 'react';

import { aiChatStream } from '@/lib/api';
import type { AiChatMessage } from '@/types/api';

/**
 * 📘 hooks/useAiStream.ts —— AI 流式对话 hook（技术栈：fetch + ReadableStream + AbortController）
 *
 * 封装 lib/api.ts 的 aiChatStream 消费逻辑：
 * - 发送消息 → 用 for await 逐段读取增量，通过 onDelta 回调更新（打字机效果）；
 * - AbortController 支持中断（stop 按钮）；
 * - 统一管理 streaming / error 状态。详情页「AI 智能助手」使用。
 */
export function useAiStream() {
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const stream = async (messages: AiChatMessage[], onDelta: (full: string) => void): Promise<string> => {
    setStreaming(true);
    setError('');
    const ac = new AbortController();
    abortRef.current = ac;
    let full = '';
    try {
      for await (const delta of aiChatStream(messages, ac.signal)) {
        full += delta;
        onDelta(full);
      }
      return full;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      return '';
    } finally {
      setStreaming(false);
    }
  };

  /** 中断当前生成 */
  const stop = () => {
    abortRef.current?.abort();
  };

  return { streaming, error, stream, stop };
}
