import Link from "next/link";
import { ScoreBadge } from "@/components/domain/ScoreBadge";
import { StatusSelect } from "@/components/domain/StatusSelect";
import type { ScoreSummary } from "@/lib/intelligence/types";
import type { ScoringConfig } from "@/lib/scoring/config";
import {
  LEAD_INDUSTRY_LABELS,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_VALUES,
  nextActionFor,
} from "@/lib/leads/constants";
import type { Lead } from "@/lib/leads/types";

export function PipelineBoard({
  leads,
  scores,
  config,
}: {
  leads: Lead[];
  scores: Map<string, ScoreSummary>;
  config: ScoringConfig;
}) {
  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-3">
      {LEAD_STATUS_VALUES.map((status) => {
        const column = leads.filter((lead) => lead.status === status);
        return (
          <section
            key={status}
            aria-label={LEAD_STATUS_LABELS[status]}
            className="w-56 shrink-0 rounded-xl bg-muted p-2.5"
          >
            <h2 className="flex items-center justify-between px-1.5 pb-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {LEAD_STATUS_LABELS[status]}
              <span className="font-mono tabular-nums">{column.length}</span>
            </h2>
            <ul className="flex flex-col gap-2">
              {column.map((lead) => (
                <li
                  key={lead.id}
                  className="rounded-lg bg-card p-3 text-sm shadow-xs ring-1 ring-foreground/10"
                >
                  <Link
                    href={`/leads/${lead.id}`}
                    className="rounded-sm font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {lead.company_name}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {LEAD_INDUSTRY_LABELS[lead.industry]}
                    {lead.address_city ? ` · ${lead.address_city}` : ""}
                  </p>
                  {scores.has(lead.id) ? (
                    <div className="mt-2">
                      <ScoreBadge
                        score={scores.get(lead.id)?.opportunity}
                        reachable={scores.get(lead.id)?.reachable}
                        config={config}
                      />
                    </div>
                  ) : null}
                  {nextActionFor(lead.status) ? (
                    <p className="mt-2 text-xs">
                      <span className="text-muted-foreground">Nächste Aktion: </span>
                      {nextActionFor(lead.status)}
                    </p>
                  ) : null}
                  <StatusSelect leadId={lead.id} status={lead.status} className="mt-2 h-8 text-xs" />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
