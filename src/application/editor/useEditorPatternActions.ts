'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Visibility } from '../../domain/pattern';
import { useEditorStore } from './editorStore';
import { usePatternStore } from '../pattern/patternStore';

type UseEditorPatternActionsOptions = {
  patternName: string;
  patternDescription: string;
  patternVisibility: Visibility;
  currentPatternId?: string;
  onToast: (msg: string) => void;
  onSavedMetaClose?: () => void;
};

/** 图纸保存 / 开始拼豆（先存再跳转） */
export function useEditorPatternActions({
  patternName,
  patternDescription,
  patternVisibility,
  currentPatternId,
  onToast,
  onSavedMetaClose,
}: UseEditorPatternActionsOptions) {
  const router = useRouter();
  const mappedPixelData = useEditorStore((s) => s.mappedPixelData);
  const gridDimensions = useEditorStore((s) => s.gridDimensions);
  const colorCounts = useEditorStore((s) => s.colorCounts);
  const totalBeadCount = useEditorStore((s) => s.totalBeadCount);
  const originalImageSrc = useEditorStore((s) => s.originalImageSrc);
  const selectedColorSystem = useEditorStore((s) => s.selectedColorSystem);

  const buildInput = useCallback(
    () => ({
      name: patternName.trim() || '未命名图纸',
      description: patternDescription,
      tags: [] as string[],
      visibility: patternVisibility,
      data: {
        mappedPixelData: mappedPixelData!,
        gridDimensions: gridDimensions!,
        colorCounts,
        totalBeadCount,
        originalImageSrc,
        selectedColorSystem,
      },
    }),
    [
      patternName,
      patternDescription,
      patternVisibility,
      mappedPixelData,
      gridDimensions,
      colorCounts,
      totalBeadCount,
      originalImageSrc,
      selectedColorSystem,
    ],
  );

  const handleSavePattern = useCallback(() => {
    if (!mappedPixelData || !gridDimensions) {
      onToast('请先上传图片生成图纸');
      return;
    }
    try {
      const saved = usePatternStore.getState().savePattern(buildInput(), currentPatternId);
      if (!currentPatternId) {
        router.replace(`/?patternId=${encodeURIComponent(saved.id)}`);
      }
      onSavedMetaClose?.();
      onToast('图纸已保存');
    } catch (err) {
      const message = err instanceof Error ? err.message : '保存失败';
      onToast(message);
    }
  }, [
    mappedPixelData,
    gridDimensions,
    buildInput,
    currentPatternId,
    router,
    onToast,
    onSavedMetaClose,
  ]);

  const handleStartBeading = useCallback(() => {
    if (!mappedPixelData || !gridDimensions || gridDimensions.N <= 0) {
      onToast('请先生成有效图纸');
      return;
    }
    try {
      const saved = usePatternStore.getState().savePattern(buildInput(), currentPatternId);
      if (!currentPatternId) {
        router.replace(`/?patternId=${encodeURIComponent(saved.id)}`);
      }
      router.push(`/bead/${saved.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : '保存失败';
      onToast(message);
    }
  }, [mappedPixelData, gridDimensions, buildInput, currentPatternId, router, onToast]);

  return {
    handleSavePattern,
    handleStartBeading,
  };
}
