import { getCloudflareContext } from '@opennextjs/cloudflare';

type RuntimeEnv = Record<string, unknown>;

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
let cfEnvCache: RuntimeEnv | null | undefined;

function asEnv(env: unknown): RuntimeEnv {
  return env && typeof env === 'object' ? (env as RuntimeEnv) : {};
}

async function readCloudflareEnv(): Promise<RuntimeEnv | null> {
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
    cfEnvCache = asEnv(ctx.env);
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
 * 读取运行时配置：优先 process.env，其次 Cloudflare Worker / .dev.vars 绑定。
 * OpenNext 本地开发时 ADMIN_* 等常只在 env binding 上，不在 process.env。
 */
export async function getRuntimeSecret(name: string): Promise<string | undefined> {
  const fromProcess = process.env[name]?.trim();
  if (fromProcess) return fromProcess;

  const bag = await readCloudflareEnv();
  const raw = bag?.[name];
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  return undefined;
}

export type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
};

export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch?<T = unknown>(statements: D1PreparedStatement[]): Promise<T[]>;
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
  delete(key: string): Promise<void>;
}

/**
 * 读取 D1：优先 OpenNext/Workers 的 getCloudflareContext().env（本地 next dev + 生产 Worker）
 */
export async function getDB(): Promise<D1Database | null> {
  const bag = await readCloudflareEnv();
  const fromBag = bag?.perler_beads || bag?.DB;
  if (fromBag) return fromBag as D1Database;

  const g = globalThis as typeof globalThis & {
    DB?: D1Database;
    perler_beads?: D1Database;
    env?: { DB?: D1Database; perler_beads?: D1Database };
  };
  return g.perler_beads || g.DB || g.env?.perler_beads || g.env?.DB || null;
}

/** 读取 R2：绑定名 `perler_beads_assets` */
export async function getR2(): Promise<R2Bucket | null> {
  const bag = await readCloudflareEnv();
  if (bag?.perler_beads_assets) return bag.perler_beads_assets as R2Bucket;

  const g = globalThis as typeof globalThis & {
    perler_beads_assets?: R2Bucket;
    env?: { perler_beads_assets?: R2Bucket };
  };
  return g.perler_beads_assets || g.env?.perler_beads_assets || null;
}

/** 开发调试：清空 CF env 缓存（例如切换 remote 后） */
export function resetCloudflareEnvCache() {
  cfEnvCache = undefined;
  cfEnvCooldownUntil = 0;
}
