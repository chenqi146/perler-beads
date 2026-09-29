'use client';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { usePatternStore } from '../../../stores';
import EnsureSession from '../../../components/EnsureSession';
import { PageLoading } from '../../../components/ui/PageLoading';

function EditorRouteContent() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const loadPattern = usePatternStore((s) => s.loadPattern);

  useEffect(() => {
    if (loadPattern(id)) router.replace(`/?patternId=${encodeURIComponent(id)}`);
  }, [id, router, loadPattern]);

  return <PageLoading label="正在打开图纸编辑器" />;
}

export default function EditorRoute() {
  return (
    <EnsureSession>
      <EditorRouteContent />
    </EnsureSession>
  );
}
