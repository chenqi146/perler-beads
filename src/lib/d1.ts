import { getCloudflareContext } from '@opennextjs/cloudflare';

export interface D1Database {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results: T[] }>;
      run(): Promise<unknown>;
    };
  };
}

/** Cloudflare R2 bucket binding (S3-compatible subset used by Workers) */
export interface R2Bucket {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | string | Blob | ReadableStream,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  get(key: string): Promise<{
    body: ReadableStream;
    httpMetadata?: { contentType?: string };
  } | null>;
}

type EnvBag = {
  DB?: D1Database;
  perler_beads?: D1Database;
  perler_beads_assets?: R2Bucket;
};

function fromBag(env: EnvBag | undefined | null): EnvBag {
  return env || {};
}

/**
 * 读取 D1：优先 OpenNext/Workers 的 getCloudflareContext().env（本地 next dev + 生产 Worker）
 */
export async function getDB(): Promise<D1Database | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const bag = fromBag(env as EnvBag);
    if (bag.perler_beads || bag.DB) return bag.perler_beads || bag.DB || null;
  } catch {
    // fall through
  }

  const g = globalThis as typeof globalThis & EnvBag & { env?: EnvBag };
  return g.perler_beads || g.DB || g.env?.perler_beads || g.env?.DB || null;
}

/** 读取 R2：绑定名 `perler_beads_assets` */
export async function getR2(): Promise<R2Bucket | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const bag = fromBag(env as EnvBag);
    if (bag.perler_beads_assets) return bag.perler_beads_assets;
  } catch {
    // fall through
  }

  const g = globalThis as typeof globalThis & EnvBag & { env?: EnvBag };
  return g.perler_beads_assets || g.env?.perler_beads_assets || null;
}
