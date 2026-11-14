/**
 * Setup check: open /api/health after deploying. Shows only whether each
 * variable is set (never its value) and whether the database answers.
 */
import { NextResponse } from "next/server";
import { getDb, sql } from "@etr/db";

export const dynamic = "force-dynamic";

const REQUIRED = [
  "APP_URL", "AUTH_URL", "AUTH_SECRET", "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET",
  "ALLOWED_EMAILS", "DATABASE_URL", "ENCRYPTION_KEY", "REDIS_URL",
] as const;

export async function GET() {
  const env = Object.fromEntries(REQUIRED.map((k) => [k, Boolean(process.env[k])]));
  let database = "ok";
  try {
    await getDb().execute(sql`select 1 from workspaces limit 1`);
  } catch (err) {
    const msg = (err as Error).message;
    database = msg.includes("does not exist") ? "connected, but tables missing: run pnpm db:migrate" : `error: ${msg.slice(0, 160)}`;
  }
  const keyOk = (() => { try { return Buffer.from(process.env.ENCRYPTION_KEY ?? "", "base64").length === 32; } catch { return false; } })();
  const missing = REQUIRED.filter((k) => !env[k]);
  return NextResponse.json({
    ok: missing.length === 0 && database === "ok" && keyOk,
    missing, database, encryptionKeyValid: keyOk,
    googleRedirectUris: process.env.APP_URL
      ? [`${process.env.APP_URL}/api/auth/callback/google`, `${process.env.APP_URL}/api/accounts/gmail/callback`]
      : "set APP_URL first",
  });
}
