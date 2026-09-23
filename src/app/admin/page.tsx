import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminUsersClient } from '@/components/admin/AdminUsersClient';
import { PlatformListSkeleton } from '@/components/ui/PlatformListSkeleton';
import { getAdminEmail, requireAdminPage } from '@/lib/admin';
import { listUsersForAdmin } from '@/lib/adminQueries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '用户管理',
};

async function AdminUsersData() {
  await requireAdminPage();
  const { items } = await listUsersForAdmin();
  return <AdminUsersClient initialUsers={items} adminEmail={getAdminEmail()} />;
}

export default function AdminPage() {
  return (
    <Suspense fallback={<PlatformListSkeleton title="用户管理" eyebrow="ADMIN" />}>
      <AdminUsersData />
    </Suspense>
  );
}
