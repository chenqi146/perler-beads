'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { AdminUserRow } from '@/lib/adminQueries';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  initialUsers: AdminUserRow[];
  adminEmail: string;
};

type RoleFilter = 'all' | 'registered' | 'guest' | 'admin';

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
const DEFAULT_PAGE_SIZE = 20;

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

export function AdminUsersClient({ initialUsers, adminEmail }: Props) {
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  const registeredCount = useMemo(
    () => initialUsers.filter((u) => !u.isAnonymous).length,
    [initialUsers],
  );
  const guestCount = useMemo(
    () => initialUsers.filter((u) => u.isAnonymous).length,
    [initialUsers],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...initialUsers].sort((a, b) => {
      if (a.isAnonymous !== b.isAnonymous) return a.isAnonymous ? 1 : -1;
      return b.createdAt - a.createdAt;
    });

    return sorted.filter((user) => {
      const isAdmin = Boolean(user.email && user.email === adminEmail);
      if (roleFilter === 'admin' && !isAdmin) return false;
      if (roleFilter === 'guest' && !user.isAnonymous) return false;
      if (roleFilter === 'registered' && user.isAnonymous) return false;

      if (!q) return true;
      const hay = `${user.name} ${user.email || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [adminEmail, initialUsers, query, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    setPage(1);
  }, [query, roleFilter, pageSize]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, pageSize, safePage]);

  const pageWindow = buildPageWindow(safePage, totalPages);
  const hasFilters = Boolean(query.trim()) || roleFilter !== 'all';

  const goTo = (next: number) => {
    setPage(Math.min(totalPages, Math.max(1, next)));
  };

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">ADMIN</p>
          <h1>用户管理</h1>
          <p className="mt-1 text-sm text-[#8a6a4a]">
            管理员账号：{adminEmail} · 共 {registeredCount} 个注册用户
            {guestCount > 0 ? ` · ${guestCount} 个游客` : ''}
          </p>
        </div>
      </header>

      <div className="admin-toolbar">
        <label className="admin-toolbar-search">
          <span className="sr-only">搜索用户</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索昵称或账号…"
            autoComplete="off"
            enterKeyHint="search"
          />
        </label>

        <div className="admin-toolbar-field">
          <span>角色</span>
          <Select
            value={roleFilter}
            onValueChange={(value) => setRoleFilter(value as RoleFilter)}
          >
            <SelectTrigger className="h-10 w-full bg-white" aria-label="按角色筛选">
              <SelectValue placeholder="全部角色" />
            </SelectTrigger>
            <SelectContent position="popper" align="start">
              <SelectGroup>
                <SelectItem value="all">全部角色</SelectItem>
                <SelectItem value="registered">注册用户</SelectItem>
                <SelectItem value="guest">游客</SelectItem>
                <SelectItem value="admin">管理员</SelectItem>
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
                    {n} 条
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <p className="admin-toolbar-count" aria-live="polite">
          {hasFilters
            ? `找到 ${filtered.length} / ${initialUsers.length} 人`
            : `共 ${filtered.length} 人`}
        </p>
      </div>

      <section className="admin-table-panel">
        {pageItems.length === 0 ? (
          <EmptyState
            motif={hasFilters ? 'search' : 'quiet'}
            size="compact"
            className="empty-panel--flush"
            kicker={hasFilters ? '筛选' : '用户'}
            title={hasFilters ? '没有符合条件的用户' : '暂无用户'}
            description={
              hasFilters ? '试试换个关键词或账号类型。' : '注册用户出现后会显示在这里。'
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-[#eadfce] hover:bg-transparent">
                <TableHead className="h-11 px-4 text-[#8a6a4a]">用户</TableHead>
                <TableHead className="h-11 px-4 text-[#8a6a4a]">账号</TableHead>
                <TableHead className="h-11 px-4 text-[#8a6a4a]">最近访问</TableHead>
                <TableHead className="h-11 px-4 text-[#8a6a4a]">IP / 归属</TableHead>
                <TableHead className="h-11 px-4 text-[#8a6a4a]">注册时间</TableHead>
                <TableHead className="h-11 px-4 text-right text-[#8a6a4a]">图纸</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((user) => (
                <TableRow
                  key={user.id}
                  className="border-[#eadfce] hover:bg-[#f3e6d4]/60"
                >
                  <TableCell className="px-4 py-3.5">
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="block font-medium text-[#3a2416] hover:underline"
                    >
                      {user.name}
                      {user.isAnonymous ? (
                        <span className="ml-2 text-xs font-normal text-[#8a6a4a]">游客</span>
                      ) : null}
                      {user.email === adminEmail ? (
                        <span className="ml-2 text-xs font-normal text-[#c47a2c]">管理员</span>
                      ) : null}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[14rem] truncate px-4 py-3.5 text-[#5c4030]">
                    {user.isAnonymous ? '本机游客' : user.email || '—'}
                  </TableCell>
                  <TableCell className="px-4 py-3.5 text-[#8a6a4a]">
                    {user.isAnonymous ? formatTime(user.lastSeenAt || 0) : '—'}
                  </TableCell>
                  <TableCell className="px-4 py-3.5">
                    {user.isAnonymous ? (
                      <div className="min-w-[8rem]">
                        <p className="font-mono text-xs text-[#5c4030]">
                          {user.lastIp || '—'}
                        </p>
                        <p className="mt-0.5 max-w-[12rem] truncate text-xs text-[#8a6a4a]">
                          {user.lastIpGeo || (user.lastIp ? '归属解析中…' : '—')}
                        </p>
                      </div>
                    ) : (
                      <span className="text-[#8a6a4a]">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3.5 text-[#8a6a4a]">
                    {formatTime(user.createdAt)}
                  </TableCell>
                  <TableCell className="px-4 py-3.5 text-right font-semibold text-[#3a2416]">
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="hover:underline"
                    >
                      {user.patternCount}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {filtered.length > 0 ? (
          <div className="admin-table-footer">
            <p className="admin-table-range">
              第 {(safePage - 1) * pageSize + 1}–
              {Math.min(safePage * pageSize, filtered.length)} 条，共 {filtered.length} 条
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
      </section>
    </main>
  );
}
