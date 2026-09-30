import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { InventoryColorDetailClient } from '@/components/inventory/InventoryColorDetailClient';
import { PlatformListSkeleton } from '@/components/ui/PlatformListSkeleton';
import { pathParamToHex } from '@/domain/inventory/hex';
import { requireRegisteredUser } from '@/lib/auth';
import { listLotsByHex } from '@/lib/inventoryQueries';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ hex: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { hex: raw } = await params;
  const hex = pathParamToHex(raw);
  return { title: hex ? `批次 · ${hex}` : '色详情 · 豆仓' };
}

async function ColorData({ hexParam }: { hexParam: string }) {
  const user = await requireRegisteredUser(`/inventory/color/${hexParam}`);
  const hex = pathParamToHex(hexParam);
  if (!hex) notFound();
  const { data } = await listLotsByHex(user.id, hex, { includeEmpty: true });
  return <InventoryColorDetailClient hex={hex} initialLots={data} />;
}

export default async function InventoryColorPage({ params }: Props) {
  const { hex } = await params;
  return (
    <Suspense fallback={<PlatformListSkeleton title="色详情" eyebrow="LOTS" />}>
      <ColorData hexParam={hex} />
    </Suspense>
  );
}
