import { redirect } from "next/navigation";
import { auth } from "@/auth";

/** Every server page/action calls this. All DB queries must filter by the returned workspaceId. */
export async function requireSession() {
  const session = await auth();
  if (!session?.userId || !session.workspaceId) redirect("/signin");
  return { userId: session.userId, workspaceId: session.workspaceId, user: session.user };
}
