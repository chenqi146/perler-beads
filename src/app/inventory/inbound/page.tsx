import type { Metadata } from 'next';
import { Suspense } from 'react';
import { InventoryInboundClient } from '@/components/inventory/InventoryInboundClient';
import { PlatformListSkeleton } from '@/components/ui/PlatformListSkeleton';
import { requireRegisteredUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'CSV 导入 · 豆仓',
};

async function Gate() {
  await requireRegisteredUser('/inventory/inbound');
  return <InventoryInboundClient />;
}

export default function InventoryInboundPage() {
  return (
    <Suspense fallback={<PlatformListSkeleton title="CSV 导入" eyebrow="CSV IMPORT" />}>
      <Gate />
    </Suspense>
  );
}
