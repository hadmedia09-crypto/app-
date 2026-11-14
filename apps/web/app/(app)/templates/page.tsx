import { FileText } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/empty-state";
import { requireSession } from "@/lib/session";

export default async function Page() {
  await requireSession();
  return (
    <>
      <PageHeader title="Templates" />
      <EmptyState icon={FileText} title="No templates yet" body="Save your best emails with {{first_name}} and {{company}} variables. Templates arrive in Phase 2." />
    </>
  );
}
