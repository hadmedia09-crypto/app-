/**
 * The contract every channel implements. The scheduler, rate limiter and inbox
 * only ever talk to this interface, never to Gmail/WhatsApp/LinkedIn directly.
 */
import type { connectedAccounts } from "@etr/db";

export type Channel = "gmail" | "outlook" | "whatsapp" | "linkedin" | "sms";
export type AccountRow = typeof connectedAccounts.$inferSelect;

export interface OutboundMessage {
  to: string;
  toName?: string | null;
  subject?: string;
  html: string;
  text: string;
  /** Provider thread to continue (Gmail threadId) + RFC ids for proper threading. */
  threadId?: string | null;
  inReplyTo?: string | null;
  references?: string | null;
  /** One-click unsubscribe URL (RFC 8058). Required for campaign emails. */
  unsubscribeUrl?: string | null;
}

export interface SendResult {
  providerId: string;
  providerThreadId: string | null;
  rfcMessageId: string | null;
}

export interface InboundMessage {
  providerId: string;
  providerThreadId: string;
  from: string;
  subject?: string;
  text: string;
  html?: string;
  receivedAt: Date;
  inReplyTo?: string | null;
}

export type HealthStatus = "ok" | "needs_reauth" | "limited" | "error";
export interface Health { status: HealthStatus; score: number; detail?: string }

export interface ChannelAdapter {
  readonly channel: Channel;
  /** "auto" sends by itself; "manual" creates a task the user completes (LinkedIn semi-auto). */
  readonly mode: "auto" | "manual";
  send(account: AccountRow, msg: OutboundMessage): Promise<SendResult>;
  fetchReplies(account: AccountRow, cursor: string | null): Promise<{ messages: InboundMessage[]; cursor: string | null }>;
  getHealth(account: AccountRow): Promise<Health>;
  getDailyLimit(account: AccountRow): number;
}

/** Errors that mean "the user must reconnect", so the account is flagged instead of retried. */
export class ReauthRequiredError extends Error {
  constructor(message = "Account needs to be reconnected") { super(message); this.name = "ReauthRequiredError"; }
}
/** Provider throttled us; the worker reschedules instead of failing. */
export class RateLimitedError extends Error {
  constructor(message = "Provider rate limit hit", public retryAfterSeconds = 900) { super(message); this.name = "RateLimitedError"; }
}
