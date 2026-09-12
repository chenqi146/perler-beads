/**
 * 兼容层：旧 beadProgress util → Zustand store
 * 新代码请直接用 useBeadProgressStore
 */
import { useBeadProgressStore } from '../stores';

export function getCompletedColors(patternId: string): string[] {
  return useBeadProgressStore.getState().getCompletedColors(patternId);
}

export function setColorCompleted(
  patternId: string,
  hexKey: string,
  completed: boolean,
): string[] {
  return useBeadProgressStore.getState().setColorCompleted(patternId, hexKey, completed, null);
}

export function clearBeadProgress(patternId: string) {
  useBeadProgressStore.getState().clearPattern(patternId);
}
