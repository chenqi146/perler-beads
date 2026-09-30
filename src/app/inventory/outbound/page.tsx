import type { Metadata } from 'next';
import { Suspense } from 'react';
import { InventoryOutboundClient } from '@/components/inventory/InventoryOutboundClient';
import { PlatformListSkeleton } from '@/components/ui/PlatformListSkeleton';
import { requireRegisteredUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '出库 · 豆仓',
};

async function Gate() {
  await requireRegisteredUser('/inventory/outbound');
  return <InventoryOutboundClient />;
}

export default function InventoryOutboundPage() {
  return (
    <Suspense fallback={<PlatformListSkeleton title="出库" eyebrow="OUTBOUND" />}>
      <Gate />
    </Suspense>
  );
}
