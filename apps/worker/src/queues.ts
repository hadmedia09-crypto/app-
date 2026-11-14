import { Queue } from "bullmq";
import { Redis } from "ioredis";

/** BullMQ requires maxRetriesPerRequest: null on worker connections. */
export const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", { maxRetriesPerRequest: null });

export const QUEUES = { maintenance: "maintenance", send: "send" } as const;

export const maintenanceQueue = new Queue(QUEUES.maintenance, { connection });
// Phase 3: the scheduler enqueues one job per due message here, jobId = message id (dedupe).
export const sendQueue = new Queue(QUEUES.send, {
  connection,
  defaultJobOptions: { attempts: 5, backoff: { type: "exponential", delay: 60_000 }, removeOnComplete: 1000, removeOnFail: 5000 },
});
