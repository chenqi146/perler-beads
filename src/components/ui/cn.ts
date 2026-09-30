import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** 合并 class；后写的 Tailwind 工具类覆盖冲突项（如 Overlay 的 max-w-full vs 弹窗 max-w-2xl） */
export function cn(...parts: ClassValue[]): string {
  return twMerge(clsx(parts));
}
