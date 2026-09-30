'use client';

import { useId, type ReactNode } from 'react';

const CELL = 34;
const VIEW_W = 420;
const VIEW_H = 300;

type Bead = { c: number; r: number; color: string; delay: string };
type Peg = { c: number; r: number };

export type EmptyStateMotif = 'board' | 'community' | 'search' | 'gallery' | 'quiet';

type MotifLayout = {
  beads: Bead[];
  next?: Peg;
  frame?: { c: number; r: number; cols: number; rows: number };
};

const MOTIFS: Record<EmptyStateMotif, MotifLayout> = {
  board: {
    beads: [
      { c: 1, r: 3, color: '#e8b86a', delay: '40ms' },
      { c: 2, r: 3, color: '#c47a2c', delay: '110ms' },
      { c: 3, r: 3, color: '#a24b32', delay: '180ms' },
      { c: 1, r: 4, color: '#c45c4a', delay: '250ms' },
      { c: 2, r: 4, color: '#f6efe4', delay: '320ms' },
      { c: 3, r: 4, color: '#5c4030', delay: '390ms' },
    ],
    next: { c: 4, r: 3 },
  },
  community: {
    beads: [
      { c: 2, r: 2, color: '#e8b86a', delay: '40ms' },
      { c: 5, r: 2, color: '#c45c4a', delay: '140ms' },
      { c: 8, r: 3, color: '#5c4030', delay: '240ms' },
      { c: 3, r: 5, color: '#c47a2c', delay: '340ms' },
      { c: 6, r: 5, color: '#a24b32', delay: '440ms' },
      { c: 9, r: 6, color: '#f6efe4', delay: '540ms' },
    ],
  },
  search: {
    beads: [
      { c: 2, r: 3, color: '#e8b86a', delay: '60ms' },
      { c: 4, r: 4, color: '#c47a2c', delay: '180ms' },
      { c: 7, r: 3, color: '#a24b32', delay: '300ms' },
    ],
    next: { c: 5, r: 5 },
  },
  gallery: {
    beads: [
      { c: 3, r: 2, color: '#e8b86a', delay: '40ms' },
      { c: 4, r: 2, color: '#c47a2c', delay: '100ms' },
      { c: 5, r: 2, color: '#a24b32', delay: '160ms' },
      { c: 3, r: 3, color: '#c45c4a', delay: '220ms' },
      { c: 4, r: 3, color: '#f6efe4', delay: '280ms' },
      { c: 5, r: 3, color: '#5c4030', delay: '340ms' },
      { c: 3, r: 4, color: '#8a6a4a', delay: '400ms' },
      { c: 4, r: 4, color: '#e8b86a', delay: '460ms' },
      { c: 5, r: 4, color: '#c47a2c', delay: '520ms' },
    ],
    frame: { c: 2.35, r: 1.35, cols: 4.3, rows: 4.3 },
  },
  quiet: {
    beads: [
      { c: 3, r: 3, color: '#e8b86a', delay: '80ms' },
      { c: 4, r: 4, color: '#c47a2c', delay: '220ms' },
    ],
  },
};

function center(c: number, r: number) {
  return { cx: 18 + c * CELL + CELL / 2, cy: 16 + r * CELL + CELL / 2 };
}

type Props = {
  title: string;
  description?: ReactNode;
  kicker?: string;
  action?: ReactNode;
  motif?: EmptyStateMotif;
  index?: string;
  /** hero 用于列表页；compact 用于表格/局部空态 */
  size?: 'hero' | 'compact';
  className?: string;
};

export function EmptyState({
  title,
  description,
  kicker = '空板',
  action,
  motif = 'board',
  index = '01',
  size = 'hero',
  className,
}: Props) {
  const rawId = useId().replace(/:/g, '');
  const layout = MOTIFS[motif];
  const occupied = new Set(layout.beads.map((bead) => `${bead.c}:${bead.r}`));
  if (layout.next) occupied.add(`${layout.next.c}:${layout.next.r}`);

  const holes: { key: string; cx: number; cy: number }[] = [];
  for (let r = 0; 16 + r * CELL < VIEW_H; r += 1) {
    for (let c = 0; 18 + c * CELL < VIEW_W; c += 1) {
      if (occupied.has(`${c}:${r}`)) continue;
      const { cx, cy } = center(c, r);
      holes.push({ key: `${c}-${r}`, cx, cy });
    }
  }

  const next = layout.next ? center(layout.next.c, layout.next.r) : null;
  const frame = layout.frame
    ? {
        x: 18 + layout.frame.c * CELL,
        y: 16 + layout.frame.r * CELL,
        w: layout.frame.cols * CELL,
        h: layout.frame.rows * CELL,
      }
    : null;

  return (
    <section
      className={['empty-panel', size === 'compact' ? 'empty-panel--compact' : '', className]
        .filter(Boolean)
        .join(' ')}
      aria-labelledby={`${rawId}-title`}
    >
      <span className="empty-panel-mark empty-panel-mark--tl" aria-hidden="true" />
      <span className="empty-panel-mark empty-panel-mark--br" aria-hidden="true" />
      {size === 'hero' ? (
        <p className="empty-panel-index" aria-hidden="true">
          {index}
        </p>
      ) : null}

      <div className="empty-panel-canvas" aria-hidden="true">
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMinYMid slice">
          <defs>
            {layout.beads.map((bead) => (
              <radialGradient
                key={`${bead.c}-${bead.r}`}
                id={`${rawId}-bead-${bead.c}-${bead.r}`}
                cx="32%"
                cy="28%"
                r="75%"
              >
                <stop offset="0%" stopColor="#fffaf3" stopOpacity="0.95" />
                <stop offset="32%" stopColor={bead.color} stopOpacity="0.92" />
                <stop offset="100%" stopColor={bead.color} />
              </radialGradient>
            ))}
          </defs>

          {holes.map((hole) => (
            <g key={hole.key} transform={`translate(${hole.cx} ${hole.cy})`}>
              <circle r="7.6" fill="#f4ebe1" stroke="#e3d0bb" strokeWidth="1.2" />
              <circle r="2" cy="0.5" fill="#e0ccb6" />
            </g>
          ))}

          {frame ? (
            <rect
              x={frame.x}
              y={frame.y}
              width={frame.w}
              height={frame.h}
              rx="10"
              fill="none"
              stroke="#d4b896"
              strokeWidth="1.6"
            />
          ) : null}

          {next ? (
            <g transform={`translate(${next.cx} ${next.cy})`}>
              <g className="empty-panel-next">
                <circle
                  r="9.5"
                  fill="none"
                  stroke="#c47a2c"
                  strokeWidth="1.5"
                  strokeDasharray="2.6 2.4"
                />
                <circle r="2" fill="#e8b86a" />
              </g>
            </g>
          ) : null}

          {layout.beads.map((bead) => {
            const { cx, cy } = center(bead.c, bead.r);
            const cream = bead.color === '#f6efe4';
            return (
              <g key={`${bead.c}-${bead.r}`} transform={`translate(${cx} ${cy})`}>
                <g className="empty-panel-bead" style={{ animationDelay: bead.delay }}>
                  <ellipse cx="0" cy="3.2" rx="8" ry="2.4" fill="#3a2416" opacity="0.08" />
                  <circle r="12" fill={`url(#${rawId}-bead-${bead.c}-${bead.r})`} />
                  <circle
                    r="12"
                    fill="none"
                    stroke={cream ? '#e0d0bc' : 'rgba(58,36,22,0.2)'}
                    strokeWidth="1"
                  />
                  <circle cx="-3" cy="-3.2" r="2.3" fill="#fff" opacity="0.82" />
                  <circle r="2.8" fill="#2a1810" opacity="0.62" />
                  <circle r="1.25" cy="0.45" fill="#1a100c" opacity="0.45" />
                </g>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="empty-panel-copy">
        {kicker ? <p className="empty-panel-kicker">{kicker}</p> : null}
        <h2 id={`${rawId}-title`}>{title}</h2>
        {description ? <div className="empty-panel-desc">{description}</div> : null}
        {action ? <div className="empty-panel-action">{action}</div> : null}
      </div>
    </section>
  );
}
