import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ProfileClient } from '@/components/profile/ProfileClient';
import { PlatformListSkeleton } from '@/components/ui/PlatformListSkeleton';
import EnsureSession from '@/components/EnsureSession';
import { getCurrentUser } from '@/lib/auth';
import { getSessionUserId } from '@/lib/session';
import { listPatternsByOwner } from '@/lib/patternQueries';
import { listWorksByOwner } from '@/lib/workQueries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '个人信息',
};

async function ProfileData() {
  const userId = await getSessionUserId();
  const user = await getCurrentUser();

  const [patterns, works] = await Promise.all([
    userId ? listPatternsByOwner(userId) : Promise.resolve({ items: [] }),
    userId ? listWorksByOwner(userId) : Promise.resolve({ items: [] }),
  ]);

  return (
    <EnsureSession>
      <ProfileClient
        initialUser={
          user || {
            id: userId || '',
            email: null,
            name: '本机游客',
            isAnonymous: true,
          }
        }
        initialPatternsCount={patterns.items.length}
        initialWorksCount={works.items.length}
      />
    </EnsureSession>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<PlatformListSkeleton title="个人信息" eyebrow="PROFILE" />}>
      <ProfileData />
    </Suspense>
  );
}
