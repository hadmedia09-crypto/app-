import { effectiveDailyLimit } from "@etr/core";
import { buildMime } from "./mime";
import { getAccessToken } from "./oauth";
import {
  RateLimitedError, ReauthRequiredError,
  type AccountRow, type ChannelAdapter, type Health, type OutboundMessage, type SendResult,
} from "../types";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

export const gmailAdapter: ChannelAdapter = {
  channel: "gmail",
  mode: "auto",

  async send(account: AccountRow, msg: OutboundMessage): Promise<SendResult> {
    const token = await getAccessToken(account);
    const signature = account.signatureHtml ? `<br><br>${account.signatureHtml}` : "";
    const { raw, messageId } = buildMime({
      from: account.identity, fromName: account.displayName,
      to: msg.to, toName: msg.toName,
      subject: msg.subject ?? "(no subject)",
      html: `${msg.html}${signature}`,
      text: msg.text,
      inReplyTo: msg.inReplyTo, references: msg.references,
      unsubscribeUrl: msg.unsubscribeUrl,
      domain: account.identity.split("@")[1] ?? "mail.local",
    });

    const res = await fetch(`${API}/messages/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw, ...(msg.threadId ? { threadId: msg.threadId } : {}) }),
    });
    const json = (await res.json()) as { id?: string; threadId?: string; error?: { message?: string; status?: string } };

    if (res.status === 401) throw new ReauthRequiredError();
    if (res.status === 429 || json.error?.status === "RESOURCE_EXHAUSTED") {
      throw new RateLimitedError(json.error?.message ?? "Gmail sending limit reached");
    }
    if (!res.ok || !json.id) throw new Error(`Gmail send failed (${res.status}): ${json.error?.message ?? "unknown error"}`);

    return { providerId: json.id, providerThreadId: json.threadId ?? null, rfcMessageId: messageId };
  },

  // Implemented in Phase 3 (History API polling from account.syncCursor).
  async fetchReplies(_account, cursor) {
    return { messages: [], cursor };
  },

  async getHealth(account: AccountRow): Promise<Health> {
    try {
      const token = await getAccessToken(account);
      const res = await fetch(`${API}/profile`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) return { status: "needs_reauth", score: 0, detail: "Reconnect Gmail" };
      if (res.status === 403) {
        // gmail.readonly not granted: sending still works, profile check doesn't.
        return { status: "ok", score: 90, detail: "Send-only access" };
      }
      if (!res.ok) return { status: "error", score: 40, detail: `Gmail returned ${res.status}` };
      return { status: "ok", score: account.health };
    } catch (err) {
      if (err instanceof ReauthRequiredError) return { status: "needs_reauth", score: 0, detail: err.message };
      return { status: "error", score: 30, detail: (err as Error).message };
    }
  },

  getDailyLimit(account: AccountRow) {
    return effectiveDailyLimit(account);
  },
};
