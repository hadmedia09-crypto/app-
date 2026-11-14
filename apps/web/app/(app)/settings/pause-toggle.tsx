"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setSendingPaused } from "./actions";

export function PauseToggle({ paused }: { paused: boolean }) {
  const [pending, start] = useTransition();
  const toggle = (next: boolean) => start(async () => {
    await setSendingPaused(next);
    toast(next ? "All sending paused" : "Sending resumed", {
      action: { label: "Undo", onClick: () => start(async () => { await setSendingPaused(!next); }) },
    });
  });
  return paused
    ? <Button disabled={pending} onClick={() => toggle(false)}>Resume sending</Button>
    : <Button variant="destructive" disabled={pending} onClick={() => toggle(true)}>Pause everything</Button>;
}
