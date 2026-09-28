'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import {
  beadProgressStatusLabel,
  type BeadCraftPhase,
  type BeadProgressSummary,
} from '@/application/bead/beadProgressSummary';
import { useBeadProgressStore } from '@/application/bead/beadProgressStore';
import type { MappedPixel } from '@/domain/pixelation';
import { useToast } from '@/components/ui/ToastProvider';
import { pushCraftStatusForPattern } from '@/utils/craftSessionSync';

const STATUS_OPTIONS: {
  value: BeadCraftPhase;
  label: string;
  hint: string;
}[] = [
  { value: 'not_started', label: '还未开始拼', hint: '清空已拼格子' },
  { value: 'in_progress', label: '拼豆中', hint: '正在制作' },
  { value: 'paused', label: '已暂停', hint: '稍后再继续' },
  { value: 'completed', label: '已全部拼完', hint: '标记全部完成' },
];

type Props = {
  patternId: string;
  summary: BeadProgressSummary;
  mappedPixelData?: MappedPixel[][] | null;
  /** 空图纸时不展示进度行 */
  disabled?: boolean;
  /** 公开浏览等只读场景不展示改状态 */
  editable?: boolean;
  /** 推送会话时附带图纸快照（可选） */
  patternSnapshot?: unknown;
};

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      aria-hidden="true"
      className={open ? 'pattern-status-chevron is-open' : 'pattern-status-chevron'}
    >
      <path
        d="M3 4.5L6 7.5L9 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 列表卡片上的已拼 / 未拼进度 + 可改拼豆状态（改完推云端） */
export function PatternBeadProgress({
  patternId,
  summary,
  mappedPixelData = null,
  disabled,
  editable = true,
  patternSnapshot,
}: Props) {
  const toast = useToast();
  const setCraftStatus = useBeadProgressStore((s) => s.setCraftStatus);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuUp, setMenuUp] = useState(false);
  const [saving, setSaving] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!menuOpen) return;
    const trigger = triggerRef.current;
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setMenuUp(spaceBelow < 220);
    }
    const onPointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (rootRef.current && target && !rootRef.current.contains(target)) {
        setMenuOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  if (disabled || summary.status === 'empty') {
    return (
      <p className="pattern-bead-progress is-empty" aria-label="尚无拼豆格子">
        尚未生成格子
      </p>
    );
  }

  const label = beadProgressStatusLabel(summary.status);
  const statusClass =
    summary.status === 'completed'
      ? 'is-completed'
      : summary.status === 'paused'
        ? 'is-paused'
        : summary.status === 'in_progress'
          ? 'is-active'
          : 'is-idle';

  const applyStatus = async (next: BeadCraftPhase) => {
    if (next === summary.status || saving) {
      setMenuOpen(false);
      return;
    }

    if (next === 'not_started' && summary.done > 0) {
      if (!window.confirm('将清空这张图纸的已拼进度，确定设为「还未开始拼」？')) {
        return;
      }
    }

    if (next === 'completed' && summary.remaining > 0) {
      if (
        !window.confirm(
          `将把剩余 ${summary.remaining} 粒标记为已拼完，确定设为「已全部拼完」？`,
        )
      ) {
        return;
      }
    }

    setSaving(true);
    setCraftStatus(patternId, next, mappedPixelData);
    setMenuOpen(false);
    try {
      const sessionId = await pushCraftStatusForPattern(patternId, next, {
        patternSnapshot,
      });
      if (sessionId) {
        toast(`已更新为「${beadProgressStatusLabel(next)}」`);
      } else {
        toast(`已更新为「${beadProgressStatusLabel(next)}」（未登录则仅保存在本机）`);
      }
    } catch {
      toast(`已更新为「${beadProgressStatusLabel(next)}」，云端同步失败`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={rootRef}
      className={[
        'pattern-bead-progress',
        statusClass,
        saving ? 'is-saving' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="pattern-bead-progress-meta">
        {editable ? (
          <div className="pattern-status-control">
            <button
              ref={triggerRef}
              type="button"
              className="pattern-status-trigger touch-manipulation"
              aria-haspopup="listbox"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              disabled={saving}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className="pattern-status-dot" aria-hidden="true" />
              <span className="pattern-bead-progress-label">{label}</span>
              <ChevronIcon open={menuOpen} />
            </button>
            {menuOpen ? (
              <ul
                id={menuId}
                className={['pattern-status-menu', menuUp ? 'is-up' : '']
                  .filter(Boolean)
                  .join(' ')}
                role="listbox"
                aria-label="改拼豆状态"
              >
                {STATUS_OPTIONS.map((option) => {
                  const selected = option.value === summary.status;
                  return (
                    <li key={option.value} role="option" aria-selected={selected}>
                      <button
                        type="button"
                        className={selected ? 'is-selected' : undefined}
                        disabled={saving}
                        onClick={() => void applyStatus(option.value)}
                      >
                        <span className="pattern-status-option-main">
                          <span
                            className={`pattern-status-dot is-${option.value}`}
                            aria-hidden="true"
                          />
                          {option.label}
                        </span>
                        <span className="pattern-status-option-hint">{option.hint}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        ) : (
          <span className="pattern-bead-progress-label">
            <span className="pattern-status-dot" aria-hidden="true" />
            {label}
          </span>
        )}
        <Link
          href={`/bead/${patternId}`}
          className="pattern-bead-progress-counts"
          aria-label={`已拼 ${summary.done}，未拼 ${summary.remaining}，点击进入拼豆`}
        >
          已拼 {summary.done}
          <span aria-hidden="true"> · </span>
          未拼 {summary.remaining}
        </Link>
      </div>
      <div
        className="pattern-bead-progress-track"
        role="progressbar"
        aria-valuenow={summary.done}
        aria-valuemin={0}
        aria-valuemax={summary.total}
        aria-label="拼豆完成进度"
      >
        <div
          className="pattern-bead-progress-fill"
          style={{ width: `${summary.percent}%` }}
        />
      </div>
    </div>
  );
}
