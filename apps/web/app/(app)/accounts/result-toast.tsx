"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

const MESSAGES: Record<string, [ "success" | "error", string ]> = {
  connected: ["success", "Gmail connected"],
  denied: ["error", "You cancelled the Google permission screen"],
  bad_state: ["error", "That sign-in link expired. Try connecting again."],
  no_refresh_token: ["error", "Google didn't return offline access. Remove EasyToReach at myaccount.google.com/permissions and reconnect."],
  missing_send_scope: ["error", "Please tick the 'Send email on your behalf' box on Google's screen"],
  error: ["error", "Couldn't connect Gmail. Check the server logs."],
};

/** Shows the result of the OAuth round-trip once, then cleans the URL. */
export function ConnectResultToast() {
  const params = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    const key = params.get("gmail");
    const m = key ? MESSAGES[key] : undefined;
    if (m) { toast[m[0]](m[1]); router.replace("/accounts"); }
  }, [params, router]);
  return null;
}
