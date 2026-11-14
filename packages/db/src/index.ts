import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export * from "./schema";
export { schema };
export { and, eq, ne, desc, asc, sql, inArray, isNull, lte, gte } from "drizzle-orm";

export type DB = PostgresJsDatabase<typeof schema>;

declare global {
  // eslint-disable-next-line no-var
  var __etrDb: DB | undefined;
}

/**
 * Shared Drizzle instance. Created on first use (not at import) so `next build`
 * works without a database, and reused across Next.js hot reloads.
 */
export function getDb(): DB {
  if (globalThis.__etrDb) return globalThis.__etrDb;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 10, prepare: false });
  globalThis.__etrDb = drizzle(sql, { schema });
  return globalThis.__etrDb;
}
