import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DashboardClient } from '@/components/dashboard/DashboardClient';
import { PlatformListSkeleton } from '@/components/ui/PlatformListSkeleton';
import { requireSession } from '@/lib/auth';
import { listPatternsByOwner } from '@/lib/patternQueries';

export const metadata: Metadata = {
  title: '我的图纸',
};

async function DashboardData() {
  const userId = await requireSession('/dashboard');
  const { items } = await listPatternsByOwner(userId);
  return <DashboardClient initialPatterns={items} />;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<PlatformListSkeleton title="我的图纸" eyebrow="MY PATTERNS" />}>
      <DashboardData />
    </Suspense>
  );
}
