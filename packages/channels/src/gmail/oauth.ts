/**
 * Google OAuth for "Connect Gmail" (separate from app login).
 * We call Google's endpoints with fetch to avoid the very large googleapis SDK.
 */
import { decryptJson, encryptJson, currentKeyVersion } from "@etr/core";
import { getDb, connectedAccounts, eq } from "@etr/db";
import { ReauthRequiredError, type AccountRow } from "../types";

export const GMAIL_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/gmail.send",      // sensitive: send as the user
  "https://www.googleapis.com/auth/gmail.readonly",  // restricted: read replies (Phase 3)
];

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: number; // epoch ms
  scope?: string;
}

const TOKEN_URL = "https://oauth2.googleapis.com/token";

export function gmailRedirectUri() {
  return `${process.env.APP_URL}/api/accounts/gmail/callback`;
}

export function buildGmailAuthUrl(state: string, loginHint?: string) {
  const params = new URLSearchParams({
    client_id: process.env.AUTH_GOOGLE_ID!,
    redirect_uri: gmailRedirectUri(),
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline",          // we need a refresh token
    prompt: "consent",               // force refresh token on reconnect
    include_granted_scopes: "true",
    state,
  });
  if (loginHint) params.set("login_hint", loginHint);
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeCode(code: string): Promise<GoogleTokens & { email: string; name?: string }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: process.env.AUTH_GOOGLE_ID!, client_secret: process.env.AUTH_GOOGLE_SECRET!,
      redirect_uri: gmailRedirectUri(), grant_type: "authorization_code",
    }),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw new Error(`Google token exchange failed: ${json.error_description ?? json.error}`);

  const accessToken = String(json.access_token);
  const profile = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  }).then((r) => r.json() as Promise<{ email?: string; name?: string }>);
  if (!profile.email) throw new Error("Google did not return an email address");

  return {
    access_token: accessToken,
    refresh_token: json.refresh_token as string | undefined,
    expires_at: Date.now() + Number(json.expires_in ?? 3600) * 1000,
    scope: json.scope as string | undefined,
    email: profile.email.toLowerCase(),
    name: profile.name,
  };
}

/**
 * Returns a valid access token, refreshing (and re-encrypting) when it expires
 * within 2 minutes. Marks the account needs_reauth if Google revoked access.
 */
export async function getAccessToken(account: AccountRow): Promise<string> {
  if (!account.tokensEncrypted) throw new ReauthRequiredError("No stored tokens");
  const tokens = decryptJson<GoogleTokens>(account.tokensEncrypted);
  if (tokens.expires_at - Date.now() > 120_000) return tokens.access_token;
  if (!tokens.refresh_token) throw new ReauthRequiredError("No refresh token stored");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID!, client_secret: process.env.AUTH_GOOGLE_SECRET!,
      refresh_token: tokens.refresh_token, grant_type: "refresh_token",
    }),
  });
  const json = (await res.json()) as Record<string, unknown>;
  const db = getDb();

  if (!res.ok) {
    if (json.error === "invalid_grant") {
      // Revoked, password changed, or (in OAuth "Testing" mode) the 7-day expiry hit.
      await db.update(connectedAccounts)
        .set({ status: "needs_reauth", lastError: "Google access expired or was revoked. Reconnect Gmail." })
        .where(eq(connectedAccounts.id, account.id));
      throw new ReauthRequiredError();
    }
    throw new Error(`Token refresh failed: ${json.error_description ?? json.error}`);
  }

  const next: GoogleTokens = {
    ...tokens,
    access_token: String(json.access_token),
    expires_at: Date.now() + Number(json.expires_in ?? 3600) * 1000,
    refresh_token: (json.refresh_token as string | undefined) ?? tokens.refresh_token,
  };
  await db.update(connectedAccounts).set({
    tokensEncrypted: encryptJson(next), tokenKeyVersion: currentKeyVersion(),
    tokenExpiresAt: new Date(next.expires_at),
  }).where(eq(connectedAccounts.id, account.id));
  return next.access_token;
}
