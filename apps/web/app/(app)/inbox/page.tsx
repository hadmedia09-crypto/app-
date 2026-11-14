import { Inbox } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/empty-state";
import { requireSession } from "@/lib/session";

export default async function Page() {
  await requireSession();
  return (
    <>
      <PageHeader title="Inbox" />
      <EmptyState icon={Inbox} title="No replies yet" body="Every reply from every channel will land here, labelled Interested, Not now, Out of office and more." />
    </>
  );
}
