import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { opportunityBand, type OpportunityBand } from "@/lib/scoring/compute";
import type { ScoringConfig } from "@/lib/scoring/config";

const BAND_CLASSES: Record<OpportunityBand, string> = {
  high: "bg-warning-soft text-warning",
  standard: "bg-muted text-foreground",
  low: "bg-muted text-muted-foreground",
};

const BAND_LABELS: Record<OpportunityBand, string> = {
  high: "Hohes Potenzial",
  standard: "Standard",
  low: "Niedrige Priorität",
};

export function ScoreBadge({
  score,
  reachable,
  config,
  showLabel = false,
}: {
  score: number | null | undefined;
  reachable?: boolean;
  config: ScoringConfig;
  showLabel?: boolean;
}) {
  if (score === null || score === undefined) {
    return (
      <span className="font-mono text-muted-foreground" title="Noch nicht berechnet">
        —
      </span>
    );
  }
  const band = opportunityBand(score, config);

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span
        title={`Opportunity-Score ${score}: ${BAND_LABELS[band]}`}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-xs font-semibold tabular-nums",
          BAND_CLASSES[band],
        )}
      >
        {band === "high" ? <Flame className="size-3" aria-hidden /> : null}
        {score}
        {showLabel ? <span className="font-sans font-medium">· {BAND_LABELS[band]}</span> : null}
      </span>
      {reachable === false ? (
        <span
          title="Weder Telefon noch E-Mail hinterlegt"
          className="rounded-md bg-destructive-soft px-2 py-0.5 text-xs font-semibold text-destructive"
        >
          Nicht ansprechbar
        </span>
      ) : null}
    </span>
  );
}
