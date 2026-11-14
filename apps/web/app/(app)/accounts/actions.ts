"use server";
/** Server actions for the Accounts page. Every query is scoped by workspace_id. */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdapter, htmlToText, ReauthRequiredError, RateLimitedError } from "@etr/channels";
import { audit } from "@etr/core";
import { getDb, connectedAccounts, messages, and, eq } from "@etr/db";
import { requireSession } from "@/lib/session";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

async function loadAccount(workspaceId: string, accountId: string) {
  const [account] = await getDb().select().from(connectedAccounts)
    .where(and(eq(connectedAccounts.id, accountId), eq(connectedAccounts.workspaceId, workspaceId)));
  if (!account) throw new Error("Account not found");
  return account;
}

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
const settingsSchema = z.object({
  accountId: z.string().uuid(),
  displayName: z.string().max(80).optional(),
  dailyLimit: z.coerce.number().int().min(1).max(500),
  sendingWindowStart: hhmm,
  sendingWindowEnd: hhmm,
  timezone: z.string().refine((tz) => { try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; } }, "Unknown timezone"),
  signatureHtml: z.string().max(5000).optional(),
  warmupEnabled: z.coerce.boolean().optional(),
});

export async function updateAccountSettings(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { workspaceId, userId } = await requireSession();
  const parsed = settingsSchema.safeParse({ ...Object.fromEntries(form), warmupEnabled: form.get("warmupEnabled") === "on" });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid settings" };
  const { accountId, ...data } = parsed.data;
  if (data.sendingWindowStart >= data.sendingWindowEnd) return { ok: false, message: "Window end must be after start" };

  await loadAccount(workspaceId, accountId);
  await getDb().update(connectedAccounts).set({ ...data, warmupEnabled: data.warmupEnabled ?? false })
    .where(and(eq(connectedAccounts.id, accountId), eq(connectedAccounts.workspaceId, workspaceId)));
  await audit({ workspaceId, userId, action: "account.settings_updated", entityType: "connected_account", entityId: accountId, meta: data });
  revalidatePath("/accounts");
  return { ok: true, message: "Settings saved" };
}

const testSchema = z.object({
  accountId: z.string().uuid(),
  to: z.string().email("Enter a valid email"),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10_000),
});

/** Sends a real email through the Gmail adapter and records it as a test message. */
export async function sendTestEmail(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { workspaceId, userId } = await requireSession();
  const parsed = testSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { accountId, to, subject, body } = parsed.data;

  const account = await loadAccount(workspaceId, accountId);
  const html = body.split(/\n{2,}/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("");
  const db = getDb();
  const [row] = await db.insert(messages).values({
    workspaceId, accountId, direction: "outbound", channel: "gmail", status: "sending",
    toAddress: to, fromAddress: account.identity, subject, bodyHtml: html, bodyText: body, isTest: true, attempts: 1,
  }).returning({ id: messages.id });

  try {
    const result = await getAdapter("gmail").send(account, { to, subject, html, text: htmlToText(html) });
    await db.update(messages).set({ status: "sent", providerId: result.providerId, providerThreadId: result.providerThreadId, rfcMessageId: result.rfcMessageId, sentAt: new Date() })
      .where(eq(messages.id, row!.id));
    await audit({ workspaceId, userId, action: "message.test_sent", entityType: "message", entityId: row!.id, meta: { to, from: account.identity } });
    revalidatePath("/accounts");
    revalidatePath("/dashboard");
    return { ok: true, message: `Test email sent to ${to}` };
  } catch (err) {
    const message = err instanceof ReauthRequiredError ? "Gmail needs to be reconnected."
      : err instanceof RateLimitedError ? "Gmail's sending limit was hit. Try again later."
      : (err as Error).message;
    await db.update(messages).set({ status: "failed", error: message }).where(eq(messages.id, row!.id));
    await audit({ workspaceId, userId, action: "message.test_failed", entityType: "message", entityId: row!.id, meta: { to, error: message } });
    revalidatePath("/accounts");
    return { ok: false, message };
  }
}

export async function disconnectAccount(accountId: string): Promise<ActionResult> {
  const { workspaceId, userId } = await requireSession();
  const account = await loadAccount(workspaceId, accountId);
  // Keep the row (history references it) but wipe tokens. Also revoke at Google.
  if (account.tokensEncrypted) {
    try {
      const { decryptJson } = await import("@etr/core");
      const t = decryptJson<{ refresh_token?: string }>(account.tokensEncrypted);
      if (t.refresh_token) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(t.refresh_token)}`, { method: "POST" });
    } catch { /* best effort */ }
  }
  await getDb().update(connectedAccounts).set({ tokensEncrypted: null, status: "needs_reauth", lastError: "Disconnected by you" })
    .where(and(eq(connectedAccounts.id, accountId), eq(connectedAccounts.workspaceId, workspaceId)));
  await audit({ workspaceId, userId, action: "account.disconnected", entityType: "connected_account", entityId: accountId });
  revalidatePath("/accounts");
  return { ok: true, message: "Gmail disconnected" };
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
