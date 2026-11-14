/**
 * EasyToReach worker. Phase 1: account health checks every 30 min.
 * Phase 3 adds: scheduler tick (every minute), send worker, reply polling.
 */
import { Worker } from "bullmq";
import { getAdapter, type Channel } from "@etr/channels";
import { getDb, connectedAccounts, eq } from "@etr/db";
import { connection, maintenanceQueue, QUEUES } from "./queues";

async function checkAllAccountHealth() {
  const db = getDb();
  const accounts = await db.select().from(connectedAccounts);
  for (const account of accounts) {
    try {
      const health = await getAdapter(account.channel as Channel).getHealth(account);
      await db.update(connectedAccounts).set({
        health: health.score,
        status: health.status === "needs_reauth" ? "needs_reauth" : health.status === "ok" && account.status === "needs_reauth" ? "connected" : account.status,
        lastError: health.status === "ok" ? null : health.detail ?? null,
        lastSyncedAt: new Date(),
      }).where(eq(connectedAccounts.id, account.id));
    } catch (err) {
      console.error(`[health] ${account.identity}:`, (err as Error).message);
    }
  }
  return { checked: accounts.length };
}

async function main() {
  await maintenanceQueue.upsertJobScheduler("health-check", { every: 30 * 60_000 }, { name: "health-check" });

  const worker = new Worker(QUEUES.maintenance, async (job) => {
    if (job.name === "health-check") return checkAllAccountHealth();
    throw new Error(`Unknown maintenance job ${job.name}`);
  }, { connection, concurrency: 1 });

  worker.on("completed", (job, result) => console.log(`[worker] ${job.name} done`, result));
  worker.on("failed", (job, err) => console.error(`[worker] ${job?.name} failed:`, err.message));
  console.log("[worker] EasyToReach worker running");

  const shutdown = async () => { await worker.close(); await connection.quit(); process.exit(0); };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => { console.error(err); process.exit(1); });
