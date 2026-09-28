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

/** 本地 next dev 下 remote binding / 代理偶发永不返回，必须限时以免 API 一直 pending */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

const CF_CONTEXT_TIMEOUT_MS =
  process.env.NODE_ENV === 'development' ? 1500 : 12_000;

/** 开发态：一次超时后短时跳过 CF context，避免每个请求都空等 */
let cfEnvCooldownUntil = 0;
let cfEnvCache: EnvBag | null | undefined;

async function readCloudflareEnv(): Promise<EnvBag | null> {
  if (process.env.NODE_ENV === 'development' && Date.now() < cfEnvCooldownUntil) {
    return null;
  }
  if (cfEnvCache !== undefined) {
    return cfEnvCache;
  }

  try {
    const ctx = await withTimeout(
      getCloudflareContext({ async: true }),
      CF_CONTEXT_TIMEOUT_MS,
      'getCloudflareContext',
    );
    cfEnvCache = fromBag(ctx.env as EnvBag);
    return cfEnvCache;
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      cfEnvCooldownUntil = Date.now() + 30_000;
      console.warn('[d1] Cloudflare context unavailable, cooldown 30s', err);
    }
    return null;
  }
}

/**
 * 读取 D1：优先 OpenNext/Workers 的 getCloudflareContext().env（本地 next dev + 生产 Worker）
 */
export async function getDB(): Promise<D1Database | null> {
  const bag = await readCloudflareEnv();
  if (bag?.perler_beads || bag?.DB) return bag.perler_beads || bag.DB || null;

  const g = globalThis as typeof globalThis & EnvBag & { env?: EnvBag };
  return g.perler_beads || g.DB || g.env?.perler_beads || g.env?.DB || null;
}

/** 读取 R2：绑定名 `perler_beads_assets` */
export async function getR2(): Promise<R2Bucket | null> {
  const bag = await readCloudflareEnv();
  if (bag?.perler_beads_assets) return bag.perler_beads_assets;

  const g = globalThis as typeof globalThis & EnvBag & { env?: EnvBag };
  return g.perler_beads_assets || g.env?.perler_beads_assets || null;
}

/** 开发调试：清空 CF env 缓存（例如切换 remote 后） */
export function resetCloudflareEnvCache() {
  cfEnvCache = undefined;
  cfEnvCooldownUntil = 0;
}
