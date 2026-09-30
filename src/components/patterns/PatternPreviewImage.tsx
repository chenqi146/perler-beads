'use client';

import { useMemo } from 'react';
import {
  resolvePatternGridSrc,
  resolvePatternImageSrc,
  type PatternData,
} from '@/domain/pattern';
import { originalImagePublicUrl } from '@/utils/patternOriginalUpload';

type Props = {
  data: PatternData;
  /** 用于在数据引用不变时仍刷新预览 */
  cacheKey?: string;
  /** R2 原图 key；仅 auto 模式且无 dataURL 时使用 */
  imageKey?: string | null;
  /**
   * auto：优先原图，否则合成格子图
   * grid：始终显示拼豆图纸（格子色块）
   */
  mode?: 'auto' | 'grid';
};

export function PatternPreviewImage({
  data,
  cacheKey,
  imageKey,
  mode = 'auto',
}: Props) {
  const src = useMemo(() => {
    if (mode === 'grid') {
      return resolvePatternGridSrc(data);
    }
    const fromData = resolvePatternImageSrc(data);
    if (fromData) return fromData;
    const key =
      (typeof imageKey === 'string' && imageKey) ||
      (typeof data.originalImageKey === 'string' ? data.originalImageKey : null);
    return key ? originalImagePublicUrl(key) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 用 cacheKey + 网格尺寸避免深比较 mappedPixelData
  }, [
    mode,
    cacheKey,
    data.originalImageSrc,
    data.originalImageKey,
    data.gridDimensions.N,
    data.gridDimensions.M,
    data.mappedPixelData?.length,
    imageKey,
  ]);

  if (!src) return <span>暂无预览</span>;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" />
  );
}
