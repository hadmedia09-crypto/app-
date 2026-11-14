import { Users } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/empty-state";
import { requireSession } from "@/lib/session";

export default async function Page() {
  await requireSession();
  return (
    <>
      <PageHeader title="Contacts" />
      <EmptyState icon={Users} title="No contacts yet" body="Import a CSV or a Google Sheet, map the columns, and we'll catch duplicates. Import arrives in Phase 2." />
    </>
  );
}
