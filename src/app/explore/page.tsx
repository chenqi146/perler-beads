import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ExploreClient } from '@/components/explore/ExploreClient';
import { listPublicPatterns } from '@/lib/patternQueries';
import { listPublicWorks } from '@/lib/workQueries';
import { PlatformListSkeleton } from '@/components/ui/PlatformListSkeleton';

export const metadata: Metadata = {
  title: '公开图纸',
  description: '浏览社区公开的拼豆图纸与作品',
};

async function ExploreData() {
  const [patternsResult, worksResult] = await Promise.all([
    listPublicPatterns(),
    listPublicWorks(),
  ]);

  return (
    <ExploreClient
      initialPatterns={patternsResult.items}
      initialWorks={worksResult.items}
      cloudAvailable={patternsResult.available && worksResult.available}
    />
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<PlatformListSkeleton title="公开图纸" eyebrow="COMMUNITY" />}>
      <ExploreData />
    </Suspense>
  );
}
