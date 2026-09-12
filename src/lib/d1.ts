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

function readEnvBag(): EnvBag {
  const g = globalThis as typeof globalThis & EnvBag & { env?: EnvBag };
  const bag: EnvBag = {};
  if (g.perler_beads) bag.perler_beads = g.perler_beads;
  if (g.DB) bag.DB = g.DB;
  if (g.perler_beads_assets) bag.perler_beads_assets = g.perler_beads_assets;
  if (g.env) {
    if (g.env.perler_beads) bag.perler_beads = g.env.perler_beads;
    if (g.env.DB) bag.DB = g.env.DB;
    if (g.env.perler_beads_assets) bag.perler_beads_assets = g.env.perler_beads_assets;
  }
  try {
    const proc = process as unknown as { env?: EnvBag };
    if (proc.env?.perler_beads) bag.perler_beads = proc.env.perler_beads;
    if (proc.env?.DB) bag.DB = proc.env.DB;
    if (proc.env?.perler_beads_assets) bag.perler_beads_assets = proc.env.perler_beads_assets;
  } catch {
    // ignore
  }
  return bag;
}

/** 读取 D1：兼容 Wrangler 绑定 `perler_beads`、旧 `DB` */
export function getDB(): D1Database | null {
  const env = readEnvBag();
  return env.perler_beads || env.DB || null;
}

/** 读取 R2：绑定名 `perler_beads_assets` */
export function getR2(): R2Bucket | null {
  return readEnvBag().perler_beads_assets || null;
}
