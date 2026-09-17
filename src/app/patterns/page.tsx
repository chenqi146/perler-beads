import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PatternsClient } from '@/components/patterns/PatternsClient';
import { PlatformListSkeleton } from '@/components/ui/PlatformListSkeleton';
import { requireSession } from '@/lib/auth';
import { listPatternsByOwner } from '@/lib/patternQueries';

export const metadata: Metadata = {
  title: '我的图纸',
};

async function PatternsData() {
  const userId = await requireSession('/patterns');
  const { items } = await listPatternsByOwner(userId);
  return <PatternsClient initialPatterns={items} />;
}

export default function PatternsPage() {
  return (
    <Suspense fallback={<PlatformListSkeleton title="我的图纸" eyebrow="MY PATTERNS" />}>
      <PatternsData />
    </Suspense>
  );
}
