"use client";
import { useActionState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { Mail, Send, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { disconnectAccount, sendTestEmail, updateAccountSettings, type ActionResult } from "./actions";

export interface GmailAccountView {
  id: string; identity: string; displayName: string; status: string; health: number; lastError: string | null;
  dailyLimit: number; effectiveLimit: number; sentToday: number;
  sendingWindowStart: string; sendingWindowEnd: string; timezone: string; signatureHtml: string; warmupEnabled: boolean;
}

const STATUS: Record<string, { label: string; tone: "green" | "yellow" | "red" | "gray" }> = {
  connected: { label: "Connected", tone: "green" },
  needs_reauth: { label: "Needs re-login", tone: "red" },
  limit_reached: { label: "Limit reached", tone: "yellow" },
  paused: { label: "Paused", tone: "yellow" },
  error: { label: "Error", tone: "red" },
};

function useToastResult(state: ActionResult | null) {
  useEffect(() => { if (state) (state.ok ? toast.success : toast.error)(state.message); }, [state]);
}

export function GmailAccountCard({ account: a, defaultTestTo }: { account: GmailAccountView; defaultTestTo: string }) {
  const [saveState, save, saving] = useActionState(updateAccountSettings, null);
  const [testState, test, testing] = useActionState(sendTestEmail, null);
  const [disconnecting, startDisconnect] = useTransition();
  useToastResult(saveState);
  useToastResult(testState);

  const s = STATUS[a.status] ?? STATUS.error!;
  const healthTone = a.health >= 80 ? "bg-emerald-500" : a.health >= 50 ? "bg-amber-500" : "bg-red-500";

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2"><Mail className="size-5" /> {a.identity} <Badge tone={s.tone}>{s.label}</Badge></CardTitle>
          <CardDescription>
            {a.sentToday} of {a.effectiveLimit} sent today
            {a.warmupEnabled && a.effectiveLimit < a.dailyLimit && <> · warming up to {a.dailyLimit}/day</>}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {a.status === "needs_reauth" && <Button asChild size="sm"><a href="/api/accounts/gmail/connect">Reconnect</a></Button>}
          <Button size="sm" variant="ghost" disabled={disconnecting}
            onClick={() => { if (confirm(`Disconnect ${a.identity}? Campaigns using it will pause.`)) startDisconnect(async () => { const r = await disconnectAccount(a.id); toast(r.message); }); }}>
            Disconnect
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Health</span><span>{a.health}/100</span></div>
          <div className="h-2 rounded-full bg-muted"><div className={`h-2 rounded-full ${healthTone}`} style={{ width: `${a.health}%` }} /></div>
          {a.lastError && <p className="mt-2 flex items-center gap-1 text-xs text-red-600"><AlertTriangle className="size-3" /> {a.lastError}</p>}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <form action={save} className="space-y-3">
            <h4 className="text-sm font-semibold">Sending settings</h4>
            <input type="hidden" name="accountId" value={a.id} />
            <Field label="From name"><Input name="displayName" defaultValue={a.displayName} placeholder="Your name" /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Daily limit"><Input name="dailyLimit" type="number" min={1} max={500} defaultValue={a.dailyLimit} /></Field>
              <Field label="From"><Input name="sendingWindowStart" type="time" defaultValue={a.sendingWindowStart} /></Field>
              <Field label="Until"><Input name="sendingWindowEnd" type="time" defaultValue={a.sendingWindowEnd} /></Field>
            </div>
            <Field label="Timezone (your leads' time)"><Input name="timezone" defaultValue={a.timezone} placeholder="Europe/London" /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="warmupEnabled" defaultChecked={a.warmupEnabled} /> Gradual warm-up (start at 5/day, +2 a day)</label>
            <Field label="Signature (HTML allowed)"><Textarea name="signatureHtml" defaultValue={a.signatureHtml} placeholder="Best,<br>Your Name" /></Field>
            <Button type="submit" variant="outline" disabled={saving}>{saving ? "Saving…" : "Save settings"}</Button>
          </form>

          <form action={test} className="space-y-3">
            <h4 className="text-sm font-semibold">Send a test email</h4>
            <input type="hidden" name="accountId" value={a.id} />
            <Field label="To"><Input name="to" type="email" defaultValue={defaultTestTo} required /></Field>
            <Field label="Subject"><Input name="subject" defaultValue="Test from EasyToReach" required /></Field>
            <Field label="Message"><Textarea name="body" rows={5} required defaultValue={"Hi there,\n\nThis is a test from EasyToReach. If you can read this, Gmail sending works.\n\nThanks!"} /></Field>
            <Button type="submit" disabled={testing || a.status === "needs_reauth"}><Send /> {testing ? "Sending…" : "Send test"}</Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
