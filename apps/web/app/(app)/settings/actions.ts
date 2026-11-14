"use server";
import { revalidatePath } from "next/cache";
import { audit } from "@etr/core";
import { getDb, workspaces, eq } from "@etr/db";
import { requireSession } from "@/lib/session";

/** Global kill switch. The scheduler checks this before every send. */
export async function setSendingPaused(paused: boolean) {
  const { workspaceId, userId } = await requireSession();
  await getDb().update(workspaces).set({ sendingPaused: paused }).where(eq(workspaces.id, workspaceId));
  await audit({ workspaceId, userId, action: paused ? "workspace.paused_all" : "workspace.resumed_all" });
  revalidatePath("/", "layout");
  return paused;
}
