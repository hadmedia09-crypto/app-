/**
 * Applies pending migrations. Runs automatically before every web build
 * (so Vercel/Railway deploys create tables themselves). Skips if no DATABASE_URL.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { fileURLToPath } from "node:url";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.log("[migrate] no DATABASE_URL, skipping");
  process.exit(0);
}
const sql = postgres(url, { max: 1 });
try {
  await migrate(drizzle(sql), { migrationsFolder: fileURLToPath(new URL("./migrations", import.meta.url)) });
  console.log("[migrate] database is up to date");
} catch (err) {
  console.error("[migrate] failed:", err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
