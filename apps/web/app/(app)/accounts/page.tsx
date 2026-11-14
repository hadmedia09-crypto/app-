import { Suspense } from "react";
import { Mail, MessageCircle, Linkedin, MessageSquare } from "lucide-react";
import { effectiveDailyLimit, localDay } from "@etr/core";
import { getDb, connectedAccounts, accountDailyUsage, and, eq, inArray } from "@etr/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/empty-state";
import { requireSession } from "@/lib/session";
import { GmailAccountCard } from "./gmail-card";
import { ConnectResultToast } from "./result-toast";

export default async function AccountsPage() {
  const { workspaceId, user } = await requireSession();
  const db = getDb();
  const accounts = await db.select().from(connectedAccounts)
    .where(and(eq(connectedAccounts.workspaceId, workspaceId), eq(connectedAccounts.channel, "gmail")));

  const usage = accounts.length
    ? await db.select().from(accountDailyUsage).where(inArray(accountDailyUsage.accountId, accounts.map((a) => a.id)))
    : [];
  const sentToday = (a: (typeof accounts)[number]) => usage.find((u) => u.accountId === a.id && u.day === localDay(a.timezone))?.sent ?? 0;

  return (
    <>
      <Suspense><ConnectResultToast /></Suspense>
      <PageHeader title="Accounts" description="Connect the inboxes and channels you send from. Each one has its own limits and sending hours."
        action={<Button asChild><a href="/api/accounts/gmail/connect"><Mail /> Connect Gmail</a></Button>} />

      <div className="grid gap-4">
        {accounts.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Mail className="size-5" /> Gmail <Badge>Not connected</Badge></CardTitle>
              <CardDescription>Send from your real inbox. Replies land in your Gmail and in EasyToReach.</CardDescription>
            </CardHeader>
            <CardContent><Button asChild><a href="/api/accounts/gmail/connect">Connect Gmail</a></Button></CardContent>
          </Card>
        )}

        {accounts.map((a) => (
          <GmailAccountCard key={a.id} defaultTestTo={user?.email ?? ""}
            account={{
              id: a.id, identity: a.identity, displayName: a.displayName ?? "", status: a.status, health: a.health,
              lastError: a.lastError, dailyLimit: a.dailyLimit, effectiveLimit: effectiveDailyLimit(a), sentToday: sentToday(a),
              sendingWindowStart: a.sendingWindowStart, sendingWindowEnd: a.sendingWindowEnd, timezone: a.timezone,
              signatureHtml: a.signatureHtml ?? "", warmupEnabled: a.warmupEnabled,
            }} />
        ))}

        <div className="grid gap-4 md:grid-cols-3">
          <SoonCard icon={MessageCircle} title="WhatsApp" phase="Phase 5"
            body="WhatsApp Business Cloud API. First messages must use Meta-approved templates and need the contact's opt-in." />
          <SoonCard icon={Linkedin} title="LinkedIn" phase="Phase 6" warning
            body="Semi-automatic: we write the message and open the profile, you click send. LinkedIn has no official API for DMs." />
          <SoonCard icon={MessageSquare} title="Outlook / SMS" phase="Later"
            body="Microsoft 365 via Graph API. SMS in India needs TRAI DLT registration first." />
        </div>
      </div>
    </>
  );
}

function SoonCard({ icon: Icon, title, body, phase, warning }: { icon: typeof Mail; title: string; body: string; phase: string; warning?: boolean }) {
  return (
    <Card className="opacity-80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Icon className="size-5" /> {title} <Badge>{phase}</Badge></CardTitle>
        <CardDescription>{body}</CardDescription>
      </CardHeader>
      {warning && (
        <CardContent>
          <p className="rounded-md bg-amber-100 p-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Automating LinkedIn breaks its User Agreement and can get your account restricted. Automated mode will stay off unless you turn it on.
          </p>
        </CardContent>
      )}
    </Card>
  );
}
