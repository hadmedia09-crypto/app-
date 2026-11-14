import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
              {error === "AccessDenied" ? "This email isn't allowed. Add it to ALLOWED_EMAILS." : "Sign-in failed. Please try again."}
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
