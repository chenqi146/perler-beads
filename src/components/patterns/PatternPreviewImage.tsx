'use client';

import { useMemo } from 'react';
import { resolvePatternImageSrc, type PatternData } from '@/domain/pattern';

type Props = {
  data: PatternData;
  /** 用于在数据引用不变时仍刷新预览 */
  cacheKey?: string;
};

export function PatternPreviewImage({ data, cacheKey }: Props) {
  const src = useMemo(
    () => resolvePatternImageSrc(data),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 用 cacheKey + 网格尺寸避免深比较 mappedPixelData
    [cacheKey, data.originalImageSrc, data.gridDimensions.N, data.gridDimensions.M, data.mappedPixelData?.length],
  );

  if (!src) return <span>暂无预览</span>;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" />
  );
}
