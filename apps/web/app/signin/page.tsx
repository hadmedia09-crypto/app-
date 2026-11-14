import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ERRORS: Record<string, string> = {
  AccessDenied: "This email isn't allowed. Add it to ALLOWED_EMAILS.",
  Configuration: "Server setup problem: a variable is missing or the database isn't ready.",
  OAuthCallbackError: "Google rejected the sign-in. Check the redirect URI in Google Cloud.",
  CallbackRouteError: "Sign-in reached the server but saving your account failed (usually the database).",
};

export default async function SignIn({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Sign in to EasyToReach</CardTitle>
          <CardDescription>Use your Google account. Sending access is connected separately.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {error && (
            <p className="rounded-md bg-red-100 p-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
              {ERRORS[error] ?? "Sign-in failed."} <span className="opacity-70">(code: {error})</span>{" "}
              <a href="/api/health" className="underline">Check setup</a>
            </p>
          )}
          <form action={async () => { "use server"; await signIn("google", { redirectTo: "/dashboard" }); }}>
            <Button className="w-full" size="lg">Continue with Google</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
