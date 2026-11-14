import { getDb, auditLogs } from "@etr/db";

/** Append-only audit trail. Never throws: auditing must not break the action itself. */
export async function audit(entry: {
  workspaceId: string; userId?: string | null; action: string;
  entityType?: string; entityId?: string; meta?: Record<string, unknown>;
}) {
  try {
    await getDb().insert(auditLogs).values({ ...entry, meta: entry.meta ?? {} });
  } catch (err) {
    console.error("[audit] failed to write", entry.action, err);
  }
}
