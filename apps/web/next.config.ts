import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

// One .env at the repo root serves web, worker and migrations.
const rootEnv = fileURLToPath(new URL("../../.env", import.meta.url));
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const config: NextConfig = {
  // Workspace packages ship TypeScript source; Next compiles them.
  transpilePackages: ["@etr/db", "@etr/core", "@etr/channels"],
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
};
export default config;
