import { defineConfig } from "drizzle-kit";
import { existsSync } from "node:fs";

// Load the repo-root .env when present (Node 22+ built-in).
if (existsSync("../../.env")) process.loadEnvFile("../../.env");

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://etr:etr@localhost:5432/easytoreach" },
  strict: true,
});
