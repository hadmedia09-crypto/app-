# EasyToReach

Multi-channel outreach (Gmail now; WhatsApp, LinkedIn, SMS later) from one dashboard.

**Status: Phase 1 of 7** — project setup, Google login, full database schema, UI shell, Connect Gmail, send a test email, account health checks, audit log, global pause.

## Stack
- `apps/web` — Next.js 16 (App Router), Tailwind v4, shadcn-style components, Auth.js v5, server actions
- `apps/worker` — Node + BullMQ (Redis). Phase 1: account health check every 30 min
- `packages/db` — Drizzle ORM + Postgres schema and migrations (all 22 tables, every one has `workspace_id`)
- `packages/core` — token encryption (AES-256-GCM, versioned keys), env validation, audit log, limits/warm-up/sending-window helpers
- `packages/channels` — `ChannelAdapter` interface + Gmail adapter (OAuth, token refresh, MIME builder, send, health)

## Run it locally

Prerequisites: Node 22+, pnpm (`corepack enable`), Docker Desktop.

```bash
pnpm install
docker compose up -d                # Postgres on 5432, Redis on 6379
cp .env.example .env                # then fill it in (see below)
pnpm gen:key                        # paste output into ENCRYPTION_KEY
npx auth secret                     # or: openssl rand -base64 32  -> AUTH_SECRET
pnpm db:migrate                     # creates all 22 tables
pnpm dev                            # web on http://localhost:3000 + worker
```

## Environment variables
| Name | What |
|---|---|
| `APP_URL` | `http://localhost:3000` locally, your Railway URL in production |
| `DATABASE_URL` | Postgres connection string |
| `REDIS_URL` | Redis connection string |
| `ENCRYPTION_KEY` | 32-byte base64 key (`pnpm gen:key`). Encrypts OAuth tokens. Back it up; losing it means reconnecting every account |
| `ENCRYPTION_KEY_VERSION` | `1`. For rotation: keep old key as `ENCRYPTION_KEY_V1`, set new key + version `2` |
| `AUTH_SECRET` | Random secret for login sessions |
| `AUTH_URL` | Same as `APP_URL` |
| `ALLOWED_EMAILS` | Comma-separated emails allowed to sign in (single-user lock) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth client (below) |

## Google Cloud setup (one-time, ~10 minutes)
1. Go to https://console.cloud.google.com → project picker → **New project** → name it `EasyToReach` → Create.
2. **APIs & Services → Library** → search **Gmail API** → **Enable**.
3. **Google Auth Platform** (left menu, formerly "OAuth consent screen") → **Get started**:
   - App name `EasyToReach`, support email = your email → Next.
   - Audience: **External** (a free @gmail.com account can't pick Internal; a Workspace account can — if you send from Workspace, pick **Internal** and skip step 6's warning entirely).
   - Contact email → Finish.
4. **Data Access → Add or remove scopes**, add:
   `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`, `.../auth/gmail.send`, `.../auth/gmail.readonly` → Save.
5. **Clients → Create client** → type **Web application**:
   - Authorized JavaScript origins: `http://localhost:3000` (and your production URL later)
   - Authorized redirect URIs (both):
     - `http://localhost:3000/api/auth/callback/google` (login)
     - `http://localhost:3000/api/accounts/gmail/callback` (Connect Gmail)
     - add the same two with your production URL when you deploy
   - Create → copy Client ID / Secret into `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.
6. **Audience → Publishing status**:
   - While testing, add yourself under **Test users**.
   - ⚠️ In **Testing** status Google expires refresh tokens after **7 days**, so Gmail will show "Needs re-login" weekly. Once it works, click **Publish app** (→ "In production"). You will NOT submit for verification; when you connect you'll see "Google hasn't verified this app" → **Advanced → Go to EasyToReach (unsafe)**. That's expected for a personal tool (cap: 100 users).

## How to test Phase 1
1. Open http://localhost:3000 → **Continue with Google** → you land on the Dashboard with a 4-step checklist.
2. **Accounts → Connect Gmail** → approve (tick every box) → toast "Gmail connected"; card shows **Connected**, health 100, "0 of 5 sent today" (warm-up).
3. Change daily limit / hours / timezone / signature → **Save settings** → toast.
4. **Send test** to yourself → check your inbox (signature included) and the Gmail **Sent** folder. Dashboard checklist ticks "Send yourself a test email".
5. **Settings** → audit log shows `account.connected`, `account.settings_updated`, `message.test_sent`. Try **Pause everything** → red banner in sidebar → Undo from the toast.
6. Revoke access at https://myaccount.google.com/permissions → wait for the worker's health check (or restart the worker) → account flips to **Needs re-login**, dashboard shows it under Needs attention.
7. Press **⌘K / Ctrl+K** for the command bar; toggle dark mode at the bottom of the sidebar; shrink the window for the mobile menu.

## Deploy (fits the ₹2,000/month budget)
Railway Hobby plan (about $5/month incl. usage credit for small apps) runs everything: web, worker, Postgres, Redis.
1. Push this repo to GitHub.
2. Railway → New Project → **Deploy from GitHub** → this repo. Create two services from it:
   - **web**: root `/`, build `pnpm install && pnpm --filter web build`, start `pnpm --filter web start`
   - **worker**: build `pnpm install`, start `pnpm --filter worker start`
3. Add **Postgres** and **Redis** plugins; reference their URLs as `DATABASE_URL` / `REDIS_URL` in both services. Add every other env var to both.
4. Run `pnpm db:migrate` once from your machine with the production `DATABASE_URL` in `.env`.
5. Add the production redirect URIs in Google Cloud (step 5 above).

Why not Vercel: Vercel's free Hobby plan is for non-commercial use only, and the worker can't run there anyway; one Railway bill is simpler.

## Security notes
- No passwords are ever stored. Gmail access uses OAuth refresh tokens encrypted with AES-256-GCM.
- Login and Gmail sending use **separate** consents: logging in never grants mail access.
- Every DB query in the app is filtered by the session's `workspace_id` (ready for multi-tenant in Phase 2 of the SaaS).
- Header-injection safe MIME builder; RFC 8058 one-click unsubscribe headers are supported for campaign mail.

## Roadmap
2 Contacts import + templates · 3 Campaign builder, scheduler, queue, limits, reply detection · 4 Unified inbox + dashboard · 5 WhatsApp · 6 LinkedIn (semi-auto) · 7 AI personalization, A/B, analytics, polish
