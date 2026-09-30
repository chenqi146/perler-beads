'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { AdminPatternListItem } from '@/lib/adminQueries';
import { EmptyState } from '@/components/ui/EmptyState';
import { PatternPreviewImage } from '@/components/patterns/PatternPreviewImage';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

type Props = {
  initialPatterns: AdminPatternListItem[];
};

type VisibilityFilter = 'all' | 'public' | 'private';

const PAGE_SIZE_OPTIONS = [12, 24, 48] as const;
const DEFAULT_PAGE_SIZE = 12;

function formatTime(ts: number) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function buildPageWindow(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | 'ellipsis')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push('ellipsis');
  for (let p = start; p <= end; p += 1) pages.push(p);
  if (end < total - 1) pages.push('ellipsis');
  pages.push(total);
  return pages;
}

function AdminPatternCard({
  pattern,
  index,
}: {
  pattern: AdminPatternListItem;
  index: number;
}) {
  const { N, M } = pattern.data.gridDimensions;
  const sizeLabel = N > 0 && M > 0 ? `${N} × ${M}` : '未定尺寸';
  const beadCount = pattern.data.totalBeadCount || 0;

  return (
    <article
      className="pattern-card"
      style={{ ['--card-index' as string]: index }}
    >
      <div className="pattern-card-media">
        <Link href={`/admin/patterns/${pattern.id}`} className="pattern-preview">
          <PatternPreviewImage
            data={pattern.data}
            cacheKey={`${pattern.id}:${pattern.updatedAt}`}
            mode="grid"
          />
        </Link>
        <span
          className={`pattern-badge ${pattern.visibility === 'public' ? 'is-public' : 'is-private'}`}
        >
          {pattern.visibility === 'public' ? '公开' : '私有'}
        </span>
      </div>

      <div className="pattern-card-body">
        <div className="pattern-card-title-row">
          <h2 title={pattern.name}>{pattern.name}</h2>
          <small>{sizeLabel}</small>
        </div>
        {pattern.description ? <p>{pattern.description}</p> : null}
        <p className="admin-pattern-meta">
          <Link href={`/admin/users/${pattern.ownerId}`} className="platform-link">
            {pattern.ownerName}
          </Link>
          <span aria-hidden>·</span>
          <span>
            {pattern.ownerIsAnonymous
              ? '游客'
              : pattern.ownerEmail || '注册用户'}
          </span>
        </p>
        <p className="admin-pattern-meta admin-pattern-meta--muted">
          {beadCount > 0 ? `${beadCount} 粒 · ` : ''}
          更新 {formatTime(pattern.updatedAt)}
        </p>
      </div>

      <div className="pattern-card-actions pattern-card-actions--footer">
        <Link
          href={`/admin/users/${pattern.ownerId}`}
          className="secondary-button touch-manipulation"
        >
          作者
        </Link>
        <Link
          href={`/admin/patterns/${pattern.id}`}
          className="primary-button touch-manipulation"
        >
          打开画布
        </Link>
      </div>
    </article>
  );
}

export function AdminPatternsClient({ initialPatterns }: Props) {
  const [query, setQuery] = useState('');
  const [visibility, setVisibility] = useState<VisibilityFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  const publicCount = useMemo(
    () => initialPatterns.filter((p) => p.visibility === 'public').length,
    [initialPatterns],
  );
  const privateCount = useMemo(
    () => initialPatterns.filter((p) => p.visibility === 'private').length,
    [initialPatterns],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initialPatterns.filter((pattern) => {
      if (visibility !== 'all' && pattern.visibility !== visibility) return false;
      if (!q) return true;
      const hay = [
        pattern.name,
        pattern.description,
        pattern.ownerName,
        pattern.ownerEmail || '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [initialPatterns, query, visibility]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    setPage(1);
  }, [query, visibility, pageSize]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, pageSize, safePage]);

  const pageWindow = buildPageWindow(safePage, totalPages);
  const hasFilters = Boolean(query.trim()) || visibility !== 'all';

  const goTo = (next: number) => {
    setPage(Math.min(totalPages, Math.max(1, next)));
  };

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">ADMIN</p>
          <h1>图纸管理</h1>
          <p className="mt-1 text-sm text-[#8a6a4a]">
            共 {initialPatterns.length} 张图纸
            {initialPatterns.length > 0
              ? ` · 公开 ${publicCount} · 私有 ${privateCount}`
              : ''}
          </p>
        </div>
      </header>

      <div className="admin-toolbar">
        <label className="admin-toolbar-search">
          <span className="sr-only">搜索图纸</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索图纸名、作者或账号…"
            autoComplete="off"
            enterKeyHint="search"
          />
        </label>

        <div className="admin-toolbar-field">
          <span>可见性</span>
          <Select
            value={visibility}
            onValueChange={(value) => setVisibility(value as VisibilityFilter)}
          >
            <SelectTrigger className="h-10 w-full bg-white" aria-label="按可见性筛选">
              <SelectValue placeholder="全部可见性" />
            </SelectTrigger>
            <SelectContent position="popper" align="start">
              <SelectGroup>
                <SelectItem value="all">全部可见性</SelectItem>
                <SelectItem value="public">公开</SelectItem>
                <SelectItem value="private">私有</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="admin-toolbar-field admin-toolbar-field-sm">
          <span>每页</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => setPageSize(Number(value))}
          >
            <SelectTrigger className="h-10 w-full bg-white" aria-label="每页条数">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="start">
              <SelectGroup>
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} 张
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <p className="admin-toolbar-count" aria-live="polite">
          {hasFilters
            ? `找到 ${filtered.length} / ${initialPatterns.length} 张`
            : `共 ${filtered.length} 张`}
        </p>
      </div>

      {pageItems.length === 0 ? (
        <EmptyState
          motif={hasFilters ? 'search' : 'quiet'}
          size="compact"
          kicker={hasFilters ? '筛选' : '图纸'}
          title={hasFilters ? '没有符合条件的图纸' : '暂无图纸'}
          description={
            hasFilters ? '试试换个关键词或可见性筛选。' : '用户创建图纸后会显示在这里。'
          }
        />
      ) : (
        <section className="pattern-grid">
          {pageItems.map((pattern, index) => (
            <AdminPatternCard key={pattern.id} pattern={pattern} index={index} />
          ))}
        </section>
      )}

      {filtered.length > 0 ? (
        <div className="admin-card-footer">
          <p className="admin-table-range">
            第 {(safePage - 1) * pageSize + 1}–
            {Math.min(safePage * pageSize, filtered.length)} 张，共 {filtered.length} 张
          </p>
          {totalPages > 1 ? (
            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    text="上一页"
                    aria-disabled={safePage <= 1}
                    className={safePage <= 1 ? 'pointer-events-none opacity-40' : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      goTo(safePage - 1);
                    }}
                  />
                </PaginationItem>
                {pageWindow.map((item, idx) =>
                  item === 'ellipsis' ? (
                    <PaginationItem key={`e-${idx}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={item}>
                      <PaginationLink
                        href="#"
                        isActive={item === safePage}
                        onClick={(e) => {
                          e.preventDefault();
                          goTo(item);
                        }}
                      >
                        {item}
                      </PaginationLink>
                    </PaginationItem>
                  ),
                )}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    text="下一页"
                    aria-disabled={safePage >= totalPages}
                    className={
                      safePage >= totalPages ? 'pointer-events-none opacity-40' : undefined
                    }
                    onClick={(e) => {
                      e.preventDefault();
                      goTo(safePage + 1);
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
