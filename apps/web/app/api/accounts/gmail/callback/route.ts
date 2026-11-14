/** Google redirects here after consent. Exchanges the code, encrypts tokens, saves the account. */
import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode, GMAIL_SCOPES } from "@etr/channels";
import { audit, currentKeyVersion, encryptJson } from "@etr/core";
import { getDb, connectedAccounts } from "@etr/db";
import { auth } from "@/auth";

const back = (q: string) => NextResponse.redirect(new URL(`/accounts?${q}`, process.env.APP_URL));

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.workspaceId) return NextResponse.redirect(new URL("/signin", process.env.APP_URL));

  const { searchParams } = req.nextUrl;
  if (searchParams.get("error")) return back("gmail=denied");

  const state = searchParams.get("state");
  const code = searchParams.get("code");
  if (!state || !code || state !== req.cookies.get("etr_gmail_state")?.value) return back("gmail=bad_state");

  try {
    const t = await exchangeCode(code);
    if (!t.refresh_token) return back("gmail=no_refresh_token");

    const granted = t.scope?.split(" ") ?? [];
    const sendScope = GMAIL_SCOPES.find((s) => s.endsWith("gmail.send"))!;
    if (!granted.includes(sendScope)) return back("gmail=missing_send_scope");

    const tokensEncrypted = encryptJson({ access_token: t.access_token, refresh_token: t.refresh_token, expires_at: t.expires_at, scope: t.scope });
    const values = {
      tokensEncrypted, tokenKeyVersion: currentKeyVersion(), tokenExpiresAt: new Date(t.expires_at),
      scopes: t.scope ?? null, status: "connected" as const, lastError: null, displayName: t.name ?? null,
    };
    const [account] = await getDb().insert(connectedAccounts)
      .values({ workspaceId: session.workspaceId, channel: "gmail", identity: t.email, ...values })
      .onConflictDoUpdate({ target: [connectedAccounts.workspaceId, connectedAccounts.channel, connectedAccounts.identity], set: values })
      .returning({ id: connectedAccounts.id });

    await audit({ workspaceId: session.workspaceId, userId: session.userId, action: "account.connected", entityType: "connected_account", entityId: account?.id, meta: { channel: "gmail", identity: t.email } });

    const res = back("gmail=connected");
    res.cookies.delete({ name: "etr_gmail_state", path: "/api/accounts/gmail" });
    return res;
  } catch (err) {
    console.error("[gmail callback]", err);
    return back("gmail=error");
  }
}
