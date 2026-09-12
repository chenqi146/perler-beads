'use client';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { usePatternStore } from '../../../stores';
import RequireAuth from '../../../components/RequireAuth';

function EditorRouteContent() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const loadPattern = usePatternStore((s) => s.loadPattern);

  useEffect(() => {
    if (loadPattern(id)) router.replace(`/?patternId=${encodeURIComponent(id)}`);
  }, [id, router, loadPattern]);

  return (
    <main className="platform-page">
      <p>正在打开图纸编辑器...</p>
      <Link href="/">返回编辑器</Link>
    </main>
  );
}

export default function EditorRoute() {
  return (
    <RequireAuth>
      <EditorRouteContent />
    </RequireAuth>
  );
}
