import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { AdminUserPatternsClient } from '@/components/admin/AdminUserPatternsClient';
import { PlatformListSkeleton } from '@/components/ui/PlatformListSkeleton';
import { requireAdminPage } from '@/lib/admin';
import { getUserForAdmin, listPatternsForAdminOwner } from '@/lib/adminQueries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '用户图纸',
};

type Props = { params: Promise<{ id: string }> };

async function AdminUserPatternsData({ id }: { id: string }) {
  await requireAdminPage();
  const { user, available } = await getUserForAdmin(id);
  if (!available || !user) notFound();

  const { items } = await listPatternsForAdminOwner(id);
  return <AdminUserPatternsClient user={user} patterns={items} />;
}

export default async function AdminUserPatternsPage({ params }: Props) {
  const { id } = await params;
  return (
    <Suspense fallback={<PlatformListSkeleton title="用户图纸" eyebrow="ADMIN · USER" />}>
      <AdminUserPatternsData id={id} />
    </Suspense>
  );
}
