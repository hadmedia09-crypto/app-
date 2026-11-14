/** Validated server env. Import `env()` only on the server. */
import { z } from "zod";

const schema = z.object({
  APP_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  ENCRYPTION_KEY: z.string().min(40, "ENCRYPTION_KEY missing: run `pnpm gen:key`"),
  AUTH_GOOGLE_ID: z.string().min(1),
  AUTH_GOOGLE_SECRET: z.string().min(1),
  ALLOWED_EMAILS: z.string().default(""),
});

let cached: z.infer<typeof schema> | undefined;
export function env() {
  cached ??= schema.parse(process.env);
  return cached;
}

export function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}
