"use client";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { NAV } from "@/components/nav";

/** Cmd/Ctrl+K command bar. More commands (pause all, search contacts) arrive in later phases. */
export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setOpen((o) => !o); }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;
  const go = (href: string) => { setOpen(false); router.push(href); };
  const item = "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm aria-selected:bg-muted";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-4 pt-[15vh]" onClick={() => setOpen(false)}>
      <Command className="mx-auto max-w-lg overflow-hidden rounded-xl border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <Command.Input autoFocus placeholder="Type a command or page…" className="h-12 w-full border-b bg-transparent px-4 text-sm outline-none" />
        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="p-4 text-sm text-muted-foreground">No results.</Command.Empty>
          <Command.Group heading="Actions" className="text-xs text-muted-foreground">
            <Command.Item className={item} onSelect={() => go("/campaigns/new")}><Plus className="size-4" /> New campaign</Command.Item>
            <Command.Item className={item} onSelect={() => go("/accounts")}><Plus className="size-4" /> Connect Gmail</Command.Item>
          </Command.Group>
          <Command.Group heading="Go to" className="text-xs text-muted-foreground">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Command.Item key={href} className={item} onSelect={() => go(href)}><Icon className="size-4" /> {label}</Command.Item>
            ))}
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
