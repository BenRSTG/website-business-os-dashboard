import Image from "next/image";
import { Check, Minus, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AnalysisButton } from "@/components/domain/AnalysisButton";
import { ScoreBreakdown } from "@/components/domain/ScoreBreakdown";
import { formatDateTime } from "@/lib/datetime";
import { FINDING_CATEGORY_LABELS } from "@/lib/intelligence/audit-analysis";
import { runWebsiteAnalysis } from "@/lib/intelligence/actions";
import type { LeadAudit, LeadScoreRow } from "@/lib/intelligence/types";
import type { Lead } from "@/lib/leads/types";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{children}</h2>;
}

function Check_({ label, value }: { label: string; value: boolean | null }) {
  const Icon = value === null ? Minus : value ? Check : X;
  const tone = value === null ? "text-muted-foreground" : value ? "text-success" : "text-destructive";
  return (
    <li className="flex items-center gap-2 text-sm">
      <Icon className={`size-4 shrink-0 ${tone}`} aria-hidden />
      <span>{label}</span>
      <span className="sr-only">{value === null ? "nicht gemessen" : value ? "in Ordnung" : "auffällig"}</span>
    </li>
  );
}

function euro(value: number | null) {
  return value === null ? null : value.toLocaleString("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
}

export function AuditPanel({
  lead,
  audit,
  scores,
}: {
  lead: Lead;
  audit: LeadAudit | null;
  scores: LeadScoreRow | null;
}) {
  const hasWebsite = Boolean(lead.existing_website_url);
  const buttonLabel = hasWebsite
    ? audit || scores
      ? "Website erneut analysieren"
      : "Website analysieren"
    : scores
      ? "Scores neu berechnen"
      : "Scores berechnen";

  return (
    <div className="flex flex-col gap-4">
      {scores ? (
        <div className="grid gap-3 md:grid-cols-3">
          <ScoreBreakdown
            title="Website-Score"
            score={scores.website_score}
            factors={scores.website_score_breakdown.factors}
            emptyNote="Keine Website vorhanden: Der Website-Score ist 0."
          />
          <ScoreBreakdown
            title="Business-Potential"
            score={scores.business_potential_score}
            factors={scores.business_potential_breakdown.factors}
          />
          <ScoreBreakdown
            title="Opportunity"
            score={scores.sales_opportunity_score}
            factors={scores.opportunity_breakdown.base}
            modifiers={scores.opportunity_breakdown.modifiers}
          />
        </div>
      ) : null}

      <Card className="gap-3 px-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <SectionTitle>{hasWebsite ? "Website-Analyse" : "Scores"}</SectionTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasWebsite
                ? lead.existing_website_url?.replace(/^https?:\/\//, "")
                : "Für diesen Lead ist keine Website hinterlegt: Der Website-Score ist 0 und der Opportunity-Score erhält den Bonus."}
            </p>
          </div>
          <AnalysisButton
            run={runWebsiteAnalysis.bind(null, lead.id)}
            label={buttonLabel}
            pendingLabel={hasWebsite ? "Analysiert …" : "Berechnet …"}
            hint="Das kann bis zu einer Minute dauern."
          />
        </div>

        {scores ? (
          <p className="text-xs text-muted-foreground">
            Berechnet am {formatDateTime(scores.computed_at)} · Konfiguration v{scores.scoring_config_version}
            {audit?.cost_estimate_eur != null ? ` · KI-Kosten ca. ${euro(audit.cost_estimate_eur)}` : ""}
            {audit?.model_used ? ` · ${audit.model_used}` : ""}
          </p>
        ) : null}

        {audit?.status === "FAILED" ? (
          <p role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">
            Die letzte Analyse ist fehlgeschlagen: {audit.error_message ?? "unbekannter Fehler"}
          </p>
        ) : null}
        {audit?.status === "RUNNING" ? (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            Eine Analyse läuft oder wurde unterbrochen. Nach 10 Minuten kann sie neu gestartet werden.
          </p>
        ) : null}
        {audit && audit.warnings.length > 0 ? (
          <ul className="flex flex-col gap-1 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
            {audit.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
      </Card>

      {audit?.status === "DONE" ? (
        <>
          <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
            <Card className="gap-3 px-4">
              <SectionTitle>Technische Prüfung</SectionTitle>
              <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                <Check_ label="SSL (https)" value={audit.has_ssl} />
                <Check_ label="Meta-Title in sinnvoller Länge" value={audit.meta_title_ok} />
                <Check_ label="Meta-Description in sinnvoller Länge" value={audit.meta_description_ok} />
                <Check_ label="Saubere Überschriftenstruktur" value={audit.heading_structure_ok} />
                <Check_ label="Telefonnummer erkennbar" value={audit.phone_detected} />
                <Check_ label="Kontaktformular" value={audit.contact_form_detected} />
                <Check_ label="Karte eingebunden" value={audit.maps_embed_detected} />
                <Check_ label="Navigation" value={audit.navigation_detected} />
              </ul>
              <dl className="mt-1 grid grid-cols-3 gap-3 border-t pt-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Performance (mobil)</dt>
                  <dd className="font-mono font-semibold">{audit.pagespeed_performance_score ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Mobile-Tauglichkeit</dt>
                  <dd className="font-mono font-semibold">{audit.pagespeed_mobile_score ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Social-Profile</dt>
                  <dd className="font-mono font-semibold">{audit.social_link_count ?? "—"}</dd>
                </div>
              </dl>
            </Card>

            {audit.screenshot_data ? (
              <Card className="gap-2 px-4">
                <SectionTitle>Mobile Ansicht</SectionTitle>
                <Image
                  src={audit.screenshot_data}
                  alt={`Screenshot der Website von ${lead.company_name} auf einem Mobilgerät`}
                  width={360}
                  height={640}
                  unoptimized
                  className="h-auto w-full rounded-md ring-1 ring-foreground/10"
                />
              </Card>
            ) : null}
          </div>

          <Card className="gap-3 px-4">
            <div className="flex items-baseline justify-between gap-3">
              <SectionTitle>KI-Einschätzung</SectionTitle>
              {audit.design_quality_score !== null ? (
                <span className="text-sm">
                  Designqualität <span className="font-mono font-semibold">{audit.design_quality_score}</span> / 100
                </span>
              ) : null}
            </div>
            {audit.design_quality_score === null ? (
              <p className="text-sm text-muted-foreground">
                Keine KI-Einschätzung vorhanden (siehe Hinweise oben). Die Designqualität zählt im Score als nicht gemessen.
              </p>
            ) : (
              <dl className="grid gap-4 sm:grid-cols-2">
                {[
                  ["Vertrauenssignale", audit.trust_signals_notes],
                  ["Navigation", audit.navigation_clarity_notes],
                  ["Handlungsaufforderungen", audit.cta_effectiveness_notes],
                  ["Local-SEO", audit.local_seo_notes],
                ].map(([label, text]) => (
                  <div key={label}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="mt-0.5 text-sm">{text || "—"}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Card>

          {audit.findings.length > 0 ? (
            <Card className="gap-3 px-4">
              <SectionTitle>Befunde für das Verkaufsgespräch</SectionTitle>
              <ul className="flex flex-col divide-y">
                {audit.findings.map((finding, index) => (
                  <li key={index} className="flex gap-3 py-2 text-sm first:pt-0 last:pb-0">
                    <span className="w-28 shrink-0 text-xs font-semibold text-muted-foreground">
                      {FINDING_CATEGORY_LABELS[finding.category]}
                    </span>
                    <span>{finding.text}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
