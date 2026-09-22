import { apiFetch } from '@/utils/apiClient';

function mimeToExt(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

/** dataURL → Blob（上传用） */
export function dataUrlToBlob(dataUrl: string): Blob | null {
  const m = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  const mime = m[1] || 'image/jpeg';
  try {
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}

export function originalImagePublicUrl(key: string): string {
  return `/api/uploads/${key.split('/').map(encodeURIComponent).join('/')}`;
}

/**
 * 将图纸原图上传到 R2，返回 key / url。
 * 失败时返回 null（调用方仍可仅本地 IndexedDB）。
 */
export async function uploadPatternOriginal(
  patternId: string,
  dataUrl: string,
): Promise<{ key: string; url: string } | null> {
  if (!patternId || !dataUrl.startsWith('data:')) return null;
  const blob = dataUrlToBlob(dataUrl);
  if (!blob) return null;

  const ext = mimeToExt(blob.type || 'image/jpeg');
  const file = new File([blob], `original.${ext}`, { type: blob.type || 'image/jpeg' });
  const form = new FormData();
  form.append('file', file);
  form.append('purpose', 'pattern');
  form.append('patternId', patternId);

  try {
    const res = await apiFetch('/api/uploads', { method: 'POST', body: form }, { authRedirect: false });
    if (!res.ok) return null;
    const data = (await res.json()) as { key?: string; url?: string };
    if (!data.key || !data.url) return null;
    return { key: data.key, url: data.url };
  } catch {
    return null;
  }
}

/** 从云端下载原图为 dataURL（供编辑态 / IndexedDB） */
export async function fetchOriginalImageAsDataUrl(key: string): Promise<string | null> {
  if (!key) return null;
  try {
    const res = await apiFetch(originalImagePublicUrl(key), undefined, { authRedirect: false });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
