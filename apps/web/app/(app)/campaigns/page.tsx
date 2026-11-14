import { Send } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/empty-state";
import { requireSession } from "@/lib/session";

export default async function Page() {
  await requireSession();
  return (
    <>
      <PageHeader title="Campaigns" />
      <EmptyState icon={Send} title="No campaigns yet" body="Build a sequence like Day 1 email, Day 3 LinkedIn, Day 8 follow-up. The campaign builder arrives in Phase 3." />
    </>
  );
}
