import type { Metadata } from 'next';
import { Suspense } from 'react';
import { InventoryMovementsClient } from '@/components/inventory/InventoryMovementsClient';
import { PlatformListSkeleton } from '@/components/ui/PlatformListSkeleton';
import { requireRegisteredUser } from '@/lib/auth';
import { listMovements } from '@/lib/inventoryQueries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '流水 · 豆仓',
};

async function MovementsData() {
  const user = await requireRegisteredUser('/inventory/movements');
  const { data } = await listMovements(user.id);
  return <InventoryMovementsClient initial={data} />;
}

export default function InventoryMovementsPage() {
  return (
    <Suspense fallback={<PlatformListSkeleton title="流水" eyebrow="MOVEMENTS" />}>
      <MovementsData />
    </Suspense>
  );
}
