/**
 * EasyToReach database schema (Drizzle / Postgres).
 *
 * Multi-tenancy rule: every business table carries `workspace_id`.
 * Phase 1 has one workspace per user; Phase 2 adds members + Postgres RLS
 * without changing these tables.
 */
import {
  pgTable, pgEnum, uuid, text, timestamp, integer, boolean, jsonb,
  uniqueIndex, index, primaryKey, smallint,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const workspaceId = () => uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" });
const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
};

// ---------- Enums ----------
export const channelEnum = pgEnum("channel", ["gmail", "outlook", "whatsapp", "linkedin", "sms"]);
export const accountStatusEnum = pgEnum("account_status", ["connected", "needs_reauth", "limit_reached", "paused", "error"]);
export const memberRoleEnum = pgEnum("member_role", ["owner", "admin", "member"]);
export const contactStageEnum = pgEnum("contact_stage", ["new", "contacted", "replied", "interested", "meeting", "won", "lost"]);
export const campaignStatusEnum = pgEnum("campaign_status", ["draft", "active", "paused", "completed", "archived"]);
export const ccStateEnum = pgEnum("campaign_contact_state", ["pending", "active", "waiting_manual", "replied", "completed", "stopped", "bounced", "unsubscribed", "failed"]);
export const directionEnum = pgEnum("direction", ["outbound", "inbound"]);
export const messageStatusEnum = pgEnum("message_status", ["draft", "queued", "sending", "sent", "delivered", "failed", "received"]);
export const eventTypeEnum = pgEnum("event_type", ["queued", "sent", "delivered", "opened", "clicked", "replied", "bounced", "unsubscribed", "failed"]);
export const consentStatusEnum = pgEnum("consent_status", ["granted", "revoked", "unknown"]);

// ---------- Tenancy & users ----------
export const workspaces = pgTable("workspaces", {
  id: id(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  /** Global kill switch: when true the scheduler sends nothing. */
  sendingPaused: boolean("sending_paused").notNull().default(false),
  ...timestamps,
});

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  ...timestamps,
});

export const workspaceMembers = pgTable("workspace_members", {
  workspaceId: workspaceId(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: memberRoleEnum("role").notNull().default("owner"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.workspaceId, t.userId] })]);

// ---------- Channels ----------
export const connectedAccounts = pgTable("connected_accounts", {
  id: id(),
  workspaceId: workspaceId(),
  channel: channelEnum("channel").notNull(),
  /** The address/number/profile this account sends as, e.g. hello@domain.com */
  identity: text("identity").notNull(),
  displayName: text("display_name"),
  /** AES-256-GCM ciphertext (see @etr/core crypto). Never plaintext. */
  tokensEncrypted: text("tokens_encrypted"),
  tokenKeyVersion: smallint("token_key_version").notNull().default(1),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  scopes: text("scopes"),
  status: accountStatusEnum("status").notNull().default("connected"),
  dailyLimit: integer("daily_limit").notNull().default(30),
  /** Warm-up: effective limit = min(dailyLimit, warmupStart + days*warmupIncrement) */
  warmupEnabled: boolean("warmup_enabled").notNull().default(true),
  warmupStartedAt: timestamp("warmup_started_at", { withTimezone: true }).defaultNow(),
  sendingWindowStart: text("sending_window_start").notNull().default("09:00"), // HH:mm local
  sendingWindowEnd: text("sending_window_end").notNull().default("17:00"),
  sendingDays: jsonb("sending_days").$type<number[]>().notNull().default([1, 2, 3, 4, 5]), // 0=Sun
  timezone: text("timezone").notNull().default("Europe/London"),
  minDelaySeconds: integer("min_delay_seconds").notNull().default(120),
  maxDelaySeconds: integer("max_delay_seconds").notNull().default(420),
  signatureHtml: text("signature_html"),
  /** 0-100 health score computed by the maintenance worker. */
  health: smallint("health").notNull().default(100),
  lastError: text("last_error"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  /** Provider cursor for reply polling (Gmail historyId, etc.). */
  syncCursor: text("sync_cursor"),
  ...timestamps,
}, (t) => [uniqueIndex("connected_accounts_ws_channel_identity").on(t.workspaceId, t.channel, t.identity)]);

/** Per account per local date, how many sends happened. Source of truth for daily limits. */
export const accountDailyUsage = pgTable("account_daily_usage", {
  accountId: uuid("account_id").notNull().references(() => connectedAccounts.id, { onDelete: "cascade" }),
  day: text("day").notNull(), // YYYY-MM-DD in the account's timezone
  sent: integer("sent").notNull().default(0),
}, (t) => [primaryKey({ columns: [t.accountId, t.day] })]);

// ---------- Contacts ----------
export const contacts = pgTable("contacts", {
  id: id(),
  workspaceId: workspaceId(),
  email: text("email"),
  phone: text("phone"), // E.164
  linkedinUrl: text("linkedin_url"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  company: text("company"),
  title: text("title"),
  website: text("website"),
  country: text("country"),
  timezone: text("timezone"),
  stage: contactStageEnum("stage").notNull().default("new"),
  customFields: jsonb("custom_fields").$type<Record<string, string>>().notNull().default({}),
  emailVerification: text("email_verification"), // valid | risky | invalid | unknown
  source: text("source"),
  ...timestamps,
}, (t) => [
  uniqueIndex("contacts_ws_email").on(t.workspaceId, t.email),
  index("contacts_ws_stage").on(t.workspaceId, t.stage),
]);

export const tags = pgTable("tags", {
  id: id(), workspaceId: workspaceId(), name: text("name").notNull(), color: text("color"),
}, (t) => [uniqueIndex("tags_ws_name").on(t.workspaceId, t.name)]);

export const contactTags = pgTable("contact_tags", {
  contactId: uuid("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.contactId, t.tagId] })]);

export const lists = pgTable("lists", { id: id(), workspaceId: workspaceId(), name: text("name").notNull(), ...timestamps });
export const listContacts = pgTable("list_contacts", {
  listId: uuid("list_id").notNull().references(() => lists.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.listId, t.contactId] })]);

/** Consent per channel (WhatsApp/SMS need proof of opt-in; DPDP record-keeping). */
export const contactConsents = pgTable("contact_consents", {
  id: id(), workspaceId: workspaceId(),
  contactId: uuid("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  channel: channelEnum("channel").notNull(),
  status: consentStatusEnum("status").notNull(),
  source: text("source"), proof: text("proof"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Templates & campaigns ----------
export const templates = pgTable("templates", {
  id: id(), workspaceId: workspaceId(),
  name: text("name").notNull(), category: text("category"),
  channel: channelEnum("channel").notNull(),
  subject: text("subject"), body: text("body").notNull(),
  /** WhatsApp: Meta-approved template name + language */
  externalTemplateName: text("external_template_name"),
  ...timestamps,
});

export const campaigns = pgTable("campaigns", {
  id: id(), workspaceId: workspaceId(),
  name: text("name").notNull(),
  status: campaignStatusEnum("status").notNull().default("draft"),
  /** Accounts this campaign may send from (rotation). */
  accountIds: jsonb("account_ids").$type<string[]>().notNull().default([]),
  stopOnReply: boolean("stop_on_reply").notNull().default(true),
  trackOpens: boolean("track_opens").notNull().default(false),
  launchedAt: timestamp("launched_at", { withTimezone: true }),
  ...timestamps,
});

export const sequenceSteps = pgTable("sequence_steps", {
  id: id(), workspaceId: workspaceId(),
  campaignId: uuid("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  channel: channelEnum("channel").notNull(),
  delayDays: integer("delay_days").notNull().default(0),
  templateId: uuid("template_id").references(() => templates.id),
  condition: text("condition").notNull().default("always"), // always | no_reply
  ...timestamps,
}, (t) => [uniqueIndex("sequence_steps_campaign_pos").on(t.campaignId, t.position)]);

export const abVariants = pgTable("ab_variants", {
  id: id(), workspaceId: workspaceId(),
  stepId: uuid("step_id").notNull().references(() => sequenceSteps.id, { onDelete: "cascade" }),
  label: text("label").notNull(), subject: text("subject"), body: text("body").notNull(),
  weight: integer("weight").notNull().default(50),
});

export const campaignContacts = pgTable("campaign_contacts", {
  id: id(), workspaceId: workspaceId(),
  campaignId: uuid("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  state: ccStateEnum("state").notNull().default("pending"),
  currentStep: integer("current_step").notNull().default(0),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  assignedAccountId: uuid("assigned_account_id").references(() => connectedAccounts.id),
  personalizedLine: text("personalized_line"),
  personalizedApproved: boolean("personalized_approved").notNull().default(false),
  ...timestamps,
}, (t) => [
  uniqueIndex("campaign_contacts_unique").on(t.campaignId, t.contactId),
  index("campaign_contacts_due").on(t.state, t.nextRunAt),
]);

// ---------- Messages & events ----------
export const inboxThreads = pgTable("inbox_threads", {
  id: id(), workspaceId: workspaceId(),
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  accountId: uuid("account_id").references(() => connectedAccounts.id, { onDelete: "set null" }),
  channel: channelEnum("channel").notNull(),
  providerThreadId: text("provider_thread_id"),
  label: text("label"), // interested | not_now | ooo | unsubscribe | wrong_person
  unread: boolean("unread").notNull().default(true),
  snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  ...timestamps,
}, (t) => [index("inbox_threads_ws_last").on(t.workspaceId, t.lastMessageAt)]);

export const messages = pgTable("messages", {
  id: id(), workspaceId: workspaceId(),
  accountId: uuid("account_id").references(() => connectedAccounts.id, { onDelete: "set null" }),
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  campaignContactId: uuid("campaign_contact_id").references(() => campaignContacts.id, { onDelete: "set null" }),
  stepId: uuid("step_id").references(() => sequenceSteps.id, { onDelete: "set null" }),
  threadId: uuid("thread_id").references(() => inboxThreads.id, { onDelete: "set null" }),
  direction: directionEnum("direction").notNull(),
  channel: channelEnum("channel").notNull(),
  status: messageStatusEnum("status").notNull(),
  toAddress: text("to_address"), fromAddress: text("from_address"),
  subject: text("subject"), bodyHtml: text("body_html"), bodyText: text("body_text"),
  providerId: text("provider_id"),
  providerThreadId: text("provider_thread_id"),
  /** RFC Message-ID, used for In-Reply-To/References threading */
  rfcMessageId: text("rfc_message_id"),
  error: text("error"),
  attempts: integer("attempts").notNull().default(0),
  isTest: boolean("is_test").notNull().default(false),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  ...timestamps,
}, (t) => [
  /** Idempotency: one outbound message per lead per step, ever. */
  uniqueIndex("messages_cc_step_unique").on(t.campaignContactId, t.stepId),
  index("messages_provider").on(t.channel, t.providerId),
]);

export const events = pgTable("events", {
  id: id(), workspaceId: workspaceId(),
  type: eventTypeEnum("type").notNull(),
  messageId: uuid("message_id").references(() => messages.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }),
  meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("events_ws_type_time").on(t.workspaceId, t.type, t.occurredAt)]);

// ---------- Safety ----------
export const suppressionList = pgTable("suppression_list", {
  id: id(), workspaceId: workspaceId(),
  /** Email, E.164 phone, LinkedIn URL, or a whole domain like "@acme.com" */
  value: text("value").notNull(),
  reason: text("reason").notNull(), // unsubscribed | bounced | manual | complaint
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("suppression_ws_value").on(t.workspaceId, t.value)]);

export const linkedinTasks = pgTable("linkedin_tasks", {
  id: id(), workspaceId: workspaceId(),
  campaignContactId: uuid("campaign_contact_id").references(() => campaignContacts.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // connect | message | follow_up
  message: text("message").notNull(),
  status: text("status").notNull().default("todo"), // todo | done | skipped
  doneAt: timestamp("done_at", { withTimezone: true }),
  ...timestamps,
});

export const auditLogs = pgTable("audit_logs", {
  id: id(), workspaceId: workspaceId(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(), // e.g. account.connected, message.test_sent
  entityType: text("entity_type"), entityId: text("entity_id"),
  meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("audit_ws_time").on(t.workspaceId, t.createdAt)]);
