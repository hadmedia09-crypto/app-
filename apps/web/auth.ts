/**
 * App login (Auth.js v5). Only basic profile scopes here; Gmail sending access is
 * granted separately on the Accounts page so login never depends on Gmail scopes.
 */
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { allowedEmails } from "@etr/core";
import { getDb, users, workspaces, workspaceMembers, eq } from "@etr/db";

declare module "next-auth" {
  interface Session { userId: string; workspaceId: string }
}

/** Find or create the user and their personal workspace (Phase 1: one workspace per user). */
async function ensureUserAndWorkspace(email: string, name?: string | null, image?: string | null) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({ email, name, image })
      .onConflictDoUpdate({ target: users.email, set: { name, image } }).returning();
    if (!user) throw new Error("Could not create user");
    const [member] = await tx.select().from(workspaceMembers).where(eq(workspaceMembers.userId, user.id)).limit(1);
    if (member) return { userId: user.id, workspaceId: member.workspaceId };
    const [ws] = await tx.insert(workspaces).values({ name: name ? `${name}'s workspace` : "My workspace" }).returning();
    if (!ws) throw new Error("Could not create workspace");
    await tx.insert(workspaceMembers).values({ workspaceId: ws.id, userId: user.id, role: "owner" });
    return { userId: user.id, workspaceId: ws.id };
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  pages: { signIn: "/signin", error: "/signin" },
  callbacks: {
    async signIn({ profile }) {
      const email = profile?.email?.toLowerCase();
      if (!email || profile?.email_verified === false) return false;
      const allow = allowedEmails();
      return allow.length === 0 || allow.includes(email);
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const ids = await ensureUserAndWorkspace(user.email.toLowerCase(), user.name, user.image);
        token.userId = ids.userId;
        token.workspaceId = ids.workspaceId;
      }
      return token;
    },
    async session({ session, token }) {
      session.userId = token.userId as string;
      session.workspaceId = token.workspaceId as string;
      return session;
    },
  },
});
