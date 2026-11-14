import { getDb, workspaces, eq } from "@etr/db";
import { Sidebar } from "@/components/sidebar";
import { CommandMenu } from "@/components/command-menu";
import { requireSession } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { workspaceId, user } = await requireSession();
  const [ws] = await getDb().select({ paused: workspaces.sendingPaused }).from(workspaces).where(eq(workspaces.id, workspaceId));
  return (
    <div className="md:flex">
      <Sidebar email={user?.email} paused={ws?.paused ?? false} />
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">{children}</main>
      <CommandMenu />
    </div>
  );
}
