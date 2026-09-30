import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminPatternsClient } from '@/components/admin/AdminPatternsClient';
import { PlatformListSkeleton } from '@/components/ui/PlatformListSkeleton';
import { requireAdminPage } from '@/lib/admin';
import { listAllPatternsForAdmin } from '@/lib/adminQueries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '图纸管理',
};

async function AdminPatternsData() {
  await requireAdminPage();
  const { items } = await listAllPatternsForAdmin();
  return <AdminPatternsClient initialPatterns={items} />;
}

export default function AdminPatternsPage() {
  return (
    <Suspense fallback={<PlatformListSkeleton title="图纸管理" eyebrow="ADMIN" />}>
      <AdminPatternsData />
    </Suspense>
  );
}
