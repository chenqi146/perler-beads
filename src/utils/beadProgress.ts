/**
 * 兼容层：旧 beadProgress util → Zustand store
 * 新代码请直接用 useBeadProgressStore
 */
import { useBeadProgressStore } from '../stores';

export function getCompletedColors(patternId: string): string[] {
  return useBeadProgressStore.getState().getCompleted(patternId);
}

export function setColorCompleted(patternId: string, hexKey: string, completed: boolean): string[] {
  return useBeadProgressStore.getState().setCompleted(patternId, hexKey, completed);
}

export function clearBeadProgress(patternId: string) {
  useBeadProgressStore.getState().clearPattern(patternId);
}
