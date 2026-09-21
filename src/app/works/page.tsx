import type { Metadata } from 'next';
import { Suspense } from 'react';
import { WorksClient } from '@/components/works/WorksClient';
import { PlatformListSkeleton } from '@/components/ui/PlatformListSkeleton';
import { requireSession } from '@/lib/auth';
import { listWorksByOwner } from '@/lib/workQueries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '我的作品',
};

async function WorksData() {
  const userId = await requireSession('/works');
  const { items, available } = await listWorksByOwner(userId);
  return <WorksClient initialWorks={items} cloudAvailable={available} />;
}

export default function WorksPage() {
  return (
    <Suspense fallback={<PlatformListSkeleton title="我的作品" eyebrow="MY WORKS" />}>
      <WorksData />
    </Suspense>
  );
}
