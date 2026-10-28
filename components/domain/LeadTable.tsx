import Link from "next/link";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/domain/StatusBadge";
import { formatRelativeDay } from "@/lib/datetime";
import { LEAD_INDUSTRY_LABELS } from "@/lib/leads/constants";
import type { Lead } from "@/lib/leads/types";

export function LeadTable({ leads }: { leads: Lead[] }) {
  if (leads.length === 0) {
    return (
      <Card className="items-center px-4 py-12 text-center">
        <p className="font-medium">Keine Leads gefunden</p>
        <p className="text-sm text-muted-foreground">
          Passe die Filter an oder lege einen neuen Lead an.
        </p>
      </Card>
    );
  }

  return (
    <Card className="gap-0 overflow-x-auto py-0">
      <table className="w-full min-w-[44rem] text-sm">
        <thead>
          <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3 font-semibold">Firma</th>
            <th className="px-4 py-3 font-semibold">Branche</th>
            <th className="px-4 py-3 font-semibold">Ort</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">Score</th>
            <th className="px-4 py-3 font-semibold">Nächster Kontakt</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} className="border-b last:border-b-0 hover:bg-muted/50">
              <td className="px-4 py-3 font-medium">
                <Link
                  href={`/leads/${lead.id}`}
                  className="rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {lead.company_name}
                </Link>
              </td>
              <td className="px-4 py-3">{LEAD_INDUSTRY_LABELS[lead.industry]}</td>
              <td className="px-4 py-3">{lead.address_city ?? "—"}</td>
              <td className="px-4 py-3">
                <StatusBadge status={lead.status} />
              </td>
              <td className="px-4 py-3 font-mono text-muted-foreground" title="Folgt in Milestone 3">
                —
              </td>
              <td className="px-4 py-3">{formatRelativeDay(lead.next_contact_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
