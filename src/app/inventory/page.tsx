import type { Metadata } from 'next';
import { Suspense } from 'react';
import { InventoryOverviewClient } from '@/components/inventory/InventoryOverviewClient';
import { PlatformListSkeleton } from '@/components/ui/PlatformListSkeleton';
import { requireRegisteredUser } from '@/lib/auth';
import { listColorStock } from '@/lib/inventoryQueries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '豆仓',
};

async function InventoryData() {
  const user = await requireRegisteredUser('/inventory');
  const { data, available } = await listColorStock(user.id);
  return <InventoryOverviewClient initial={data} cloudAvailable={available} />;
}

export default function InventoryPage() {
  return (
    <Suspense fallback={<PlatformListSkeleton title="豆仓" eyebrow="BEAD INVENTORY" />}>
      <InventoryData />
    </Suspense>
  );
}
