'use client';

import { useEffect, useRef, useState } from 'react';
import type { Visibility } from '../../domain/pattern';
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
  const baselinePendingRef = useRef(true);
  const savedHintTimerRef = useRef<number | null>(null);

  const mappedPixelData = useEditorStore((s) => s.mappedPixelData);
  const gridDimensions = useEditorStore((s) => s.gridDimensions);
  const colorCounts = useEditorStore((s) => s.colorCounts);
  const totalBeadCount = useEditorStore((s) => s.totalBeadCount);
  const originalImageSrc = useEditorStore((s) => s.originalImageSrc);
  const originalImageKey = useEditorStore((s) => s.originalImageKey);
  const selectedColorSystem = useEditorStore((s) => s.selectedColorSystem);
  const gridManuallyEdited = useEditorStore((s) => s.gridManuallyEdited);

  // pattern 切换 / 首次挂载：重置指纹并进入水合保护期
  useEffect(() => {
    readyAtRef.current = Date.now() + hydrateSkipMs;
    lastFingerprintRef.current = '';
    baselinePendingRef.current = true;
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

    const runSave = () => {
      if (fingerprint === lastFingerprintRef.current) return;

      // 水合后第一次只记基线，避免打开图纸就立刻云同步
      if (baselinePendingRef.current) {
        baselinePendingRef.current = false;
        lastFingerprintRef.current = fingerprint;
        return;
      }

      setAutosaveStatus('saving');
      try {
        usePatternStore.getState().savePattern(
          {
            name: patternName.trim() || '未命名图纸',
            description: patternDescription,
            tags: [],
            visibility: patternVisibility,
            data: {
              mappedPixelData,
              gridDimensions,
              colorCounts,
              totalBeadCount,
              originalImageSrc,
              originalImageKey,
              selectedColorSystem,
              gridManuallyEdited,
            },
          },
          currentPatternId,
        );
        lastFingerprintRef.current = fingerprint;
        setAutosaveStatus('saved');
        if (savedHintTimerRef.current) window.clearTimeout(savedHintTimerRef.current);
        savedHintTimerRef.current = window.setTimeout(() => setAutosaveStatus('idle'), 2200);
      } catch {
        setAutosaveStatus('error');
      }
    };

    const hydrateLeft = readyAtRef.current - Date.now();
    const delay = Math.max(debounceMs, hydrateLeft > 0 ? hydrateLeft : 0);
    const timer = window.setTimeout(runSave, delay);

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

  useEffect(
    () => () => {
      if (savedHintTimerRef.current) window.clearTimeout(savedHintTimerRef.current);
    },
    [],
  );

  return { autosaveStatus };
}
