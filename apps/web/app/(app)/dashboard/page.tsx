import Link from "next/link";
import { CheckCircle2, Circle, AlertCircle } from "lucide-react";
import { getDb, connectedAccounts, messages, contacts, campaigns, and, eq, sql } from "@etr/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/empty-state";
import { requireSession } from "@/lib/session";

export default async function Dashboard() {
  const { workspaceId } = await requireSession();
  const db = getDb();
  const count = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;
  const n = sql<number>`count(*)::int`;

  const [gmail, brokenAccounts, testSent, contactCount, campaignCount, sent, replies] = await Promise.all([
    count(db.select({ n }).from(connectedAccounts).where(and(eq(connectedAccounts.workspaceId, workspaceId), eq(connectedAccounts.status, "connected")))),
    count(db.select({ n }).from(connectedAccounts).where(and(eq(connectedAccounts.workspaceId, workspaceId), eq(connectedAccounts.status, "needs_reauth")))),
    count(db.select({ n }).from(messages).where(and(eq(messages.workspaceId, workspaceId), eq(messages.isTest, true), eq(messages.status, "sent")))),
    count(db.select({ n }).from(contacts).where(eq(contacts.workspaceId, workspaceId))),
    count(db.select({ n }).from(campaigns).where(eq(campaigns.workspaceId, workspaceId))),
    count(db.select({ n }).from(messages).where(and(eq(messages.workspaceId, workspaceId), eq(messages.direction, "outbound"), eq(messages.isTest, false), eq(messages.status, "sent")))),
    count(db.select({ n }).from(messages).where(and(eq(messages.workspaceId, workspaceId), eq(messages.direction, "inbound")))),
  ]);

  const checklist = [
    { done: gmail > 0, label: "Connect your Gmail", href: "/accounts" },
    { done: testSent > 0, label: "Send yourself a test email", href: "/accounts" },
    { done: contactCount > 0, label: "Import your leads", href: "/contacts" },
    { done: campaignCount > 0, label: "Launch your first campaign", href: "/campaigns/new" },
  ];
  const remaining = checklist.filter((c) => !c.done).length;
  const rate = sent ? `${Math.round((replies / sent) * 100)}%` : "–";

  return (
    <>
      <PageHeader title="Dashboard" description="Your outreach at a glance." />

      {remaining > 0 && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Get set up · {checklist.length - remaining} of {checklist.length} done</CardTitle></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {checklist.map((c) => (
              <Link key={c.label} href={c.href} className="flex items-center gap-2 rounded-md p-2 text-sm hover:bg-muted">
                {c.done ? <CheckCircle2 className="size-4 text-emerald-600" /> : <Circle className="size-4 text-muted-foreground" />}
                <span className={c.done ? "text-muted-foreground line-through" : ""}>{c.label}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Sent" value={sent} />
        <Stat label="Replies" value={replies} />
        <Stat label="Reply rate" value={rate} />
        <Stat label="Meetings booked" value={0} />
      </div>

      <Card>
        <CardHeader><CardTitle>Needs attention</CardTitle></CardHeader>
        <CardContent>
          {brokenAccounts > 0 ? (
            <div className="flex items-center justify-between rounded-md bg-red-50 p-3 text-sm dark:bg-red-950/40">
              <span className="flex items-center gap-2"><AlertCircle className="size-4 text-red-600" /> {brokenAccounts} account(s) need to be reconnected</span>
              <Button asChild size="sm" variant="outline"><Link href="/accounts">Fix</Link></Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing needs you right now. Replies, due follow-ups and failed sends will show up here.</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card><CardContent className="p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </CardContent></Card>
  );
}
