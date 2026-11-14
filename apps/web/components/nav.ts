import { LayoutDashboard, Send, Users, Inbox, FileText, Plug, Settings } from "lucide-react";
export const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/campaigns", label: "Campaigns", icon: Send },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/templates", label: "Templates", icon: FileText },
  { href: "/accounts", label: "Accounts", icon: Plug },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;
