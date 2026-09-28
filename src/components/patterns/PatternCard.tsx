'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  beadCraftCtaLabel,
  type BeadProgressSummary,
} from '@/application/bead/beadProgressSummary';
import type { Pattern } from '@/types/platform';
import { PatternPreviewImage } from './PatternPreviewImage';
import { PatternBeadProgress } from './PatternBeadProgress';

type Props = {
  pattern: Pattern;
  summary: BeadProgressSummary;
  index?: number;
  /** 详情页链接：dashboard/patterns 用 editor，explore 用 pattern */
  previewHref?: string;
  showVisibilityBadge?: boolean;
  editableProgress?: boolean;
  footer?: ReactNode;
};

export function PatternCard({
  pattern,
  summary,
  index = 0,
  previewHref,
  showVisibilityBadge = true,
  editableProgress = true,
  footer,
}: Props) {
  const emptyGrid = pattern.data.gridDimensions.N <= 0;
  const href = previewHref ?? `/editor/${pattern.id}`;

  return (
    <article
      className="pattern-card"
      style={{ ['--card-index' as string]: index }}
    >
      <div className="pattern-card-media">
        <Link href={href} className="pattern-preview">
          <PatternPreviewImage
            data={pattern.data}
            cacheKey={`${pattern.id}:${pattern.updatedAt}`}
          />
        </Link>
        {showVisibilityBadge ? (
          <span
            className={`pattern-badge ${pattern.visibility === 'public' ? 'is-public' : 'is-private'}`}
          >
            {pattern.visibility === 'public' ? '公开' : '私有'}
          </span>
        ) : null}
      </div>

      <div className="pattern-card-body">
        <div className="pattern-card-title-row">
          <h2 title={pattern.name}>{pattern.name}</h2>
          <small>
            {pattern.data.gridDimensions.N} × {pattern.data.gridDimensions.M}
          </small>
        </div>
        {pattern.description ? <p>{pattern.description}</p> : null}
      </div>

      <PatternBeadProgress
        patternId={pattern.id}
        summary={summary}
        mappedPixelData={pattern.data.mappedPixelData}
        disabled={emptyGrid}
        editable={editableProgress}
        patternSnapshot={pattern.data}
      />

      <div className={`pattern-card-actions ${footer ? '' : 'pattern-card-actions--footer'}`}>
        <Link href={`/editor/${pattern.id}`} className="secondary-button touch-manipulation">
          编辑
        </Link>
        <Link
          href={`/bead/${pattern.id}`}
          className={`primary-button touch-manipulation ${emptyGrid ? 'pointer-events-none opacity-40' : ''}`}
          aria-disabled={emptyGrid}
        >
          {beadCraftCtaLabel(summary.status)}
        </Link>
      </div>

      {footer ? <div className="pattern-card-tools">{footer}</div> : null}
    </article>
  );
}
