export interface D1Database { prepare(sql: string): { bind(...values: unknown[]): { first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; run(): Promise<unknown> } }; }
export function getDB(): D1Database | null { return (globalThis as typeof globalThis & { DB?: D1Database }).DB || null; }
