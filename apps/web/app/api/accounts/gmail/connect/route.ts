/** Starts the "Connect Gmail" OAuth flow with a CSRF state cookie. */
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { buildGmailAuthUrl } from "@etr/channels";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.workspaceId) return NextResponse.redirect(new URL("/signin", process.env.APP_URL));

  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(buildGmailAuthUrl(state));
  res.cookies.set("etr_gmail_state", state, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/api/accounts/gmail",
  });
  return res;
}
