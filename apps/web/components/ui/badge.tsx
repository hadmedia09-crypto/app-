import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Status colours follow the product rule: green = good/replied, yellow = waiting, red = problem. */
const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", {
  variants: {
    tone: {
      green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
      yellow: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
      red: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
      gray: "bg-muted text-muted-foreground",
    },
  },
  defaultVariants: { tone: "gray" },
});
export function Badge({ className, tone, ...p }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...p} />;
}
