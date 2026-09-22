import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DashboardClient } from '@/components/dashboard/DashboardClient';
import { PlatformListSkeleton } from '@/components/ui/PlatformListSkeleton';
import EnsureSession from '@/components/EnsureSession';
import { getSessionUserId } from '@/lib/session';
import { listPatternsByOwner } from '@/lib/patternQueries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '我的图纸',
};

async function DashboardData() {
  const userId = await getSessionUserId();
  const { items } = userId ? await listPatternsByOwner(userId) : { items: [] };
  return (
    <EnsureSession>
      <DashboardClient initialPatterns={items} />
    </EnsureSession>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<PlatformListSkeleton title="我的图纸" eyebrow="MY PATTERNS" />}>
      <DashboardData />
    </Suspense>
  );
}
