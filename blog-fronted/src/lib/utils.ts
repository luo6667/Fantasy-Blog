import { type ClassValue,clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * 合并并去重 Tailwind CSS 类名
 *
 * 用法：
 *   cn('px-4 py-2', 'bg-red-500', isActive && 'ring-2')
 *   cn('text-sm', ['flex', 'items-center'], { hidden: !visible })
 *
 * 依托 tailwind-merge 解决样式冲突（后面的类覆盖前面的同属性类），
 * 借助 clsx 支持条件类名、数组、对象等多种传参方式。
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
