import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { LeadFilters } from "@/components/domain/LeadFilters";
import { LeadTable } from "@/components/domain/LeadTable";
import { PageHeader } from "@/components/domain/PageHeader";
import { PipelineBoard } from "@/components/domain/PipelineBoard";
import { getScoreSummaries, getScoringConfig } from "@/lib/intelligence/queries";
import { listLeads, parseLeadFilters } from "@/lib/leads/queries";
import { cn } from "@/lib/utils";

const views = [
  { value: "list", label: "Liste" },
  { value: "pipeline", label: "Pipeline" },
] as const;

export default async function LeadsPage({ searchParams }: PageProps<"/leads">) {
  const params = await searchParams;
  const view = params.view === "pipeline" ? "pipeline" : "list";
  const filters = parseLeadFilters(params);
  // Im Pipeline-Board ist der Status die Spalte — ein Status-Filter ergäbe dort keinen Sinn.
  const [leads, scores, config] = await Promise.all([
    listLeads(view === "pipeline" ? { ...filters, status: undefined } : filters),
    getScoreSummaries(),
    getScoringConfig(),
  ]);

  const query = new URLSearchParams();
  if (filters.industry) query.set("industry", filters.industry);
  if (filters.city) query.set("city", filters.city);
  if (view === "list" && filters.status) query.set("status", filters.status);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Leads"
          description={`${leads.length} ${leads.length === 1 ? "Lead" : "Leads"}${
            filters.status || filters.industry || filters.city ? " (gefiltert)" : ""
          }`}
        />
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Ansicht" className="inline-flex rounded-lg bg-muted p-0.5">
            {views.map(({ value, label }) => {
              const next = new URLSearchParams(query);
              next.set("view", value);
              if (value === "pipeline") next.delete("status");
              return (
                <Link
                  key={value}
                  href={`/leads?${next.toString()}`}
                  aria-current={view === value ? "true" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    view === value
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </div>
          <Link href="/leads/new" className={buttonVariants()}>
            <Plus aria-hidden /> Neuer Lead
          </Link>
        </div>
      </div>

      <LeadFilters view={view} filters={filters} />
      {view === "pipeline" ? (
        <PipelineBoard leads={leads} scores={scores} config={config} />
      ) : (
        <LeadTable leads={leads} scores={scores} config={config} />
      )}
    </>
  );
}
