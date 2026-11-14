import { getDb, workspaces, auditLogs, eq, desc } from "@etr/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { signOut } from "@/auth";
import { requireSession } from "@/lib/session";
import { PauseToggle } from "./pause-toggle";

export default async function SettingsPage() {
  const { workspaceId } = await requireSession();
  const db = getDb();
  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
  const logs = await db.select().from(auditLogs).where(eq(auditLogs.workspaceId, workspaceId)).orderBy(desc(auditLogs.createdAt)).limit(50);

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Emergency stop</CardTitle>
            <CardDescription>Instantly stops every scheduled send on every account. Nothing is lost; resume any time.</CardDescription>
          </CardHeader>
          <CardContent><PauseToggle paused={ws?.sendingPaused ?? false} /></CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Audit log</CardTitle><CardDescription>Every important action, newest first.</CardDescription></CardHeader>
          <CardContent>
            {logs.length === 0 ? <p className="text-sm text-muted-foreground">No activity yet.</p> : (
              <ul className="divide-y text-sm">
                {logs.map((l) => (
                  <li key={l.id} className="flex justify-between gap-4 py-2">
                    <span className="font-mono text-xs">{l.action}</span>
                    <span className="text-xs text-muted-foreground">{l.createdAt.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <form action={async () => { "use server"; await signOut({ redirectTo: "/signin" }); }}>
          <Button variant="outline">Sign out</Button>
        </form>
      </div>
    </>
  );
}
