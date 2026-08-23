import { useRef, useState } from 'react';

import { aiChatStream } from '@/lib/api';
import type { AiChatMessage } from '@/types/api';

/**
 * AI 流式对话 hook
 *
 * 封装 aiChatStream 的消费逻辑：发送消息 → 通过 onDelta 回调逐段更新
 * （打字机效果），支持中断（stop）。详情页智能助手使用。
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
