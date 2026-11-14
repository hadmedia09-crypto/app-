import { Sparkles } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/empty-state";
import { requireSession } from "@/lib/session";

export default async function Page() {
  await requireSession();
  return (
    <>
      <PageHeader title="New campaign" />
      <EmptyState icon={Sparkles} title="Campaign builder coming in Phase 3" body="Audience, sequence, schedule, review, launch. First, connect Gmail and import your leads." />
    </>
  );
}
