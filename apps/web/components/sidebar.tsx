"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { NAV } from "@/components/nav";
import { cn } from "@/lib/utils";

export function Sidebar({ email, paused }: { email?: string | null; paused: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const body = (
    <div className="flex h-full flex-col gap-4 p-4">
      <Link href="/dashboard" className="flex items-center gap-2 px-2 text-lg font-semibold tracking-tight">
        <span className="grid size-7 place-items-center rounded-md bg-primary text-xs text-primary-foreground">E</span>
        EasyToReach
      </Link>
      <Button asChild className="w-full"><Link href="/campaigns/new"><Plus /> New Campaign</Link></Button>
      {paused && (
        <Link href="/settings" className="rounded-md bg-red-100 px-3 py-2 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-300">
          All sending is paused
        </Link>
      )}
      <nav className="flex flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} onClick={() => setOpen(false)}
            className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
              pathname.startsWith(href) && "bg-muted font-medium text-foreground")}>
            <Icon className="size-4" /> {label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto flex items-center justify-between gap-2 px-2 text-xs text-muted-foreground">
        <span className="truncate">{email}</span>
        <ThemeToggle />
      </div>
      <p className="px-2 text-[11px] text-muted-foreground">Press <kbd className="rounded border px-1">⌘K</kbd> for commands</p>
    </div>
  );

  return (
    <>
      <div className="flex items-center justify-between border-b p-3 md:hidden">
        <span className="font-semibold">EasyToReach</span>
        <Button variant="ghost" size="icon" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X /> : <Menu />}</Button>
      </div>
      {open && <div className="border-b md:hidden">{body}</div>}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r md:block">{body}</aside>
    </>
  );
}
