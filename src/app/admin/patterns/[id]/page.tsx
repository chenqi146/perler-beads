import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { AdminPatternDetailClient } from '@/components/admin/AdminPatternDetailClient';
import { PlatformListSkeleton } from '@/components/ui/PlatformListSkeleton';
import { requireAdminPage } from '@/lib/admin';
import { getUserForAdmin } from '@/lib/adminQueries';
import { getPatternById } from '@/lib/patternQueries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '打开图纸',
};

type Props = { params: Promise<{ id: string }> };

async function AdminPatternData({ id }: { id: string }) {
  await requireAdminPage();
  const { pattern, available } = await getPatternById(id);
  if (!available || !pattern) notFound();

  const { user } = await getUserForAdmin(pattern.ownerId);
  const ownerLabel = user
    ? `${user.name}${user.email ? ` (${user.email})` : user.isAnonymous ? ' · 游客' : ''}`
    : pattern.ownerId;

  return <AdminPatternDetailClient pattern={pattern} ownerLabel={ownerLabel} />;
}

export default async function AdminPatternPage({ params }: Props) {
  const { id } = await params;
  return (
    <Suspense fallback={<PlatformListSkeleton title="查看图纸" eyebrow="ADMIN · PATTERN" />}>
      <AdminPatternData id={id} />
    </Suspense>
  );
}
