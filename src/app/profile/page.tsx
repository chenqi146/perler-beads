import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { ProfileClient } from '@/components/profile/ProfileClient';
import { PlatformListSkeleton } from '@/components/ui/PlatformListSkeleton';
import { getCurrentUser, requireSession } from '@/lib/auth';
import { listPatternsByOwner } from '@/lib/patternQueries';
import { listWorksByOwner } from '@/lib/workQueries';

export const metadata: Metadata = {
  title: '个人信息',
};

async function ProfileData() {
  const userId = await requireSession('/profile');
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login?next=/profile');

  const [patterns, works] = await Promise.all([
    listPatternsByOwner(userId),
    listWorksByOwner(userId),
  ]);

  return (
    <ProfileClient
      initialUser={user}
      initialPatternsCount={patterns.items.length}
      initialWorksCount={works.items.length}
    />
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<PlatformListSkeleton title="个人信息" eyebrow="PROFILE" />}>
      <ProfileData />
    </Suspense>
  );
}
