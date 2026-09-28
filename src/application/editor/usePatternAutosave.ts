'use client';

import { useEffect, useRef, useState } from 'react';
import type { Visibility } from '../../domain/pattern';
import { assertPatternHasGrid } from '../../domain/pattern';
import { useEditorStore } from './editorStore';
import { usePatternStore } from '../pattern/patternStore';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

type UsePatternAutosaveOptions = {
  currentPatternId?: string;
  patternName: string;
  patternDescription: string;
  patternVisibility: Visibility;
  /** 水合后跳过自动保存的毫秒数，避免刚加载就写回 */
  hydrateSkipMs?: number;
  debounceMs?: number;
};

type PendingSnapshot = {
  fingerprint: string;
  patternId: string;
  name: string;
  description: string;
  visibility: Visibility;
  mappedPixelData: NonNullable<ReturnType<typeof useEditorStore.getState>['mappedPixelData']>;
  gridDimensions: NonNullable<ReturnType<typeof useEditorStore.getState>['gridDimensions']>;
  colorCounts: ReturnType<typeof useEditorStore.getState>['colorCounts'];
  totalBeadCount: number;
  originalImageSrc: string | null;
  originalImageKey: string | null | undefined;
  selectedColorSystem: string;
  gridManuallyEdited: boolean;
};

/**
 * 编辑模式：有 patternId 时对命名图纸防抖自动保存（local + 云端推送由 savePattern 负责）。
 */
export function usePatternAutosave({
  currentPatternId,
  patternName,
  patternDescription,
  patternVisibility,
  hydrateSkipMs = 2000,
  debounceMs = 1800,
}: UsePatternAutosaveOptions) {
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('idle');
  const readyAtRef = useRef(0);
  const lastFingerprintRef = useRef<string>('');
  /** 仅「打开时已有格子」才跳过第一次写回，避免空图纸生成后被当成水合基线丢掉 */
  const baselinePendingRef = useRef(false);
  const pendingRef = useRef<PendingSnapshot | null>(null);
  const savedHintTimerRef = useRef<number | null>(null);

  const mappedPixelData = useEditorStore((s) => s.mappedPixelData);
  const gridDimensions = useEditorStore((s) => s.gridDimensions);
  const colorCounts = useEditorStore((s) => s.colorCounts);
  const totalBeadCount = useEditorStore((s) => s.totalBeadCount);
  const originalImageSrc = useEditorStore((s) => s.originalImageSrc);
  const originalImageKey = useEditorStore((s) => s.originalImageKey);
  const selectedColorSystem = useEditorStore((s) => s.selectedColorSystem);
  const gridManuallyEdited = useEditorStore((s) => s.gridManuallyEdited);

  const persistSnapshot = (snapshot: PendingSnapshot) => {
    if (snapshot.fingerprint === lastFingerprintRef.current) return false;

    if (baselinePendingRef.current) {
      baselinePendingRef.current = false;
      lastFingerprintRef.current = snapshot.fingerprint;
      return false;
    }

    setAutosaveStatus('saving');
    try {
      usePatternStore.getState().savePattern(
        {
          name: snapshot.name.trim() || '未命名图纸',
          description: snapshot.description,
          tags: [],
          visibility: snapshot.visibility,
          data: {
            mappedPixelData: snapshot.mappedPixelData,
            gridDimensions: snapshot.gridDimensions,
            colorCounts: snapshot.colorCounts,
            totalBeadCount: snapshot.totalBeadCount,
            originalImageSrc: snapshot.originalImageSrc,
            originalImageKey: snapshot.originalImageKey,
            selectedColorSystem: snapshot.selectedColorSystem,
            gridManuallyEdited: snapshot.gridManuallyEdited,
          },
        },
        snapshot.patternId,
      );
      lastFingerprintRef.current = snapshot.fingerprint;
      setAutosaveStatus('saved');
      if (savedHintTimerRef.current) window.clearTimeout(savedHintTimerRef.current);
      savedHintTimerRef.current = window.setTimeout(() => setAutosaveStatus('idle'), 2200);
      return true;
    } catch {
      setAutosaveStatus('error');
      return false;
    }
  };

  const flushPending = () => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    persistSnapshot(pending);
  };

  // pattern 切换 / 首次挂载：重置指纹；空图纸不跳过首次保存
  useEffect(() => {
    readyAtRef.current = Date.now() + hydrateSkipMs;
    lastFingerprintRef.current = '';
    pendingRef.current = null;
    const pattern = currentPatternId
      ? usePatternStore.getState().loadPattern(currentPatternId)
      : null;
    const hadGridOnLoad = Boolean(pattern && assertPatternHasGrid(pattern.data));
    baselinePendingRef.current = hadGridOnLoad;
    setAutosaveStatus('idle');
  }, [currentPatternId, hydrateSkipMs]);

  useEffect(() => {
    if (!currentPatternId) return;
    if (!mappedPixelData?.length || !gridDimensions || gridDimensions.N <= 0 || gridDimensions.M <= 0) {
      return;
    }

    const fingerprint = JSON.stringify({
      n: gridDimensions.N,
      m: gridDimensions.M,
      totalBeadCount,
      selectedColorSystem,
      colorCounts,
      gridManuallyEdited,
      // 抽样格子指纹，避免整图 stringify 过重
      cells: mappedPixelData.map((row) =>
        row.map((cell) =>
          cell ? `${cell.isExternal ? 1 : 0}:${cell.color}:${cell.key}` : '',
        ),
      ),
      // originalImageSrc 可能很大，只记长度 + 头尾哈希感标记
      imgLen: originalImageSrc?.length ?? 0,
      imgHead: originalImageSrc?.slice(0, 32) ?? '',
      name: patternName.trim(),
      description: patternDescription,
      visibility: patternVisibility,
    });

    if (fingerprint === lastFingerprintRef.current) return;

    const snapshot: PendingSnapshot = {
      fingerprint,
      patternId: currentPatternId,
      name: patternName,
      description: patternDescription,
      visibility: patternVisibility,
      mappedPixelData,
      gridDimensions,
      colorCounts,
      totalBeadCount,
      originalImageSrc,
      originalImageKey,
      selectedColorSystem,
      gridManuallyEdited,
    };
    pendingRef.current = snapshot;

    const hydrateLeft = readyAtRef.current - Date.now();
    const delay = Math.max(debounceMs, hydrateLeft > 0 ? hydrateLeft : 0);
    const timer = window.setTimeout(() => {
      const pending = pendingRef.current;
      if (!pending || pending.fingerprint !== fingerprint) return;
      pendingRef.current = null;
      persistSnapshot(pending);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [
    currentPatternId,
    mappedPixelData,
    gridDimensions,
    colorCounts,
    totalBeadCount,
    originalImageSrc,
    originalImageKey,
    selectedColorSystem,
    gridManuallyEdited,
    patternName,
    patternDescription,
    patternVisibility,
    debounceMs,
  ]);

  // 离开页面前刷掉防抖中的保存，避免刚生成就退出丢数据
  useEffect(() => {
    const onLeave = () => flushPending();
    window.addEventListener('pagehide', onLeave);
    window.addEventListener('beforeunload', onLeave);
    return () => {
      window.removeEventListener('pagehide', onLeave);
      window.removeEventListener('beforeunload', onLeave);
      flushPending();
      if (savedHintTimerRef.current) window.clearTimeout(savedHintTimerRef.current);
    };
  }, []);

  return { autosaveStatus };
}
