import { LeadForm } from "@/components/domain/LeadForm";
import { PageHeader } from "@/components/domain/PageHeader";
import { createLead } from "@/lib/leads/actions";

export default function NewLeadPage() {
  return (
    <>
      <PageHeader title="Neuer Lead" />
      <div className="max-w-3xl">
        <LeadForm action={createLead} submitLabel="Lead anlegen" cancelHref="/leads" />
      </div>
    </>
  );
}
