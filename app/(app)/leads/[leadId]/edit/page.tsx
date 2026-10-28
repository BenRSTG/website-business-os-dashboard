import { notFound } from "next/navigation";
import { LeadForm } from "@/components/domain/LeadForm";
import { PageHeader } from "@/components/domain/PageHeader";
import { updateLead } from "@/lib/leads/actions";
import { getLead } from "@/lib/leads/queries";

export default async function EditLeadPage({ params }: PageProps<"/leads/[leadId]/edit">) {
  const { leadId } = await params;
  const lead = await getLead(leadId);
  if (!lead) notFound();

  return (
    <>
      <PageHeader title={`${lead.company_name} bearbeiten`} />
      <div className="max-w-3xl">
        <LeadForm
          action={updateLead.bind(null, lead.id)}
          lead={lead}
          submitLabel="Änderungen speichern"
          cancelHref={`/leads/${lead.id}`}
        />
      </div>
    </>
  );
}
