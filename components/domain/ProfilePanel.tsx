import { Card } from "@/components/ui/card";
import { AnalysisButton } from "@/components/domain/AnalysisButton";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/datetime";
import { FACT_CATEGORY_LABELS } from "@/lib/intelligence/company-profile";
import { runCompanyProfile } from "@/lib/intelligence/actions";
import type { CompanyProfileRow } from "@/lib/intelligence/types";

const SOURCE_LABELS = { lead_record: "Stammdaten", website: "Website", inference: "Schlussfolgerung" } as const;
const CONFIDENCE_LABELS = { high: "hoch", medium: "mittel", low: "niedrig" } as const;

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{children}</h2>;
}

export function ProfilePanel({ leadId, profile }: { leadId: string; profile: CompanyProfileRow | null }) {
  const button = (
    <AnalysisButton
      run={runCompanyProfile.bind(null, leadId)}
      label={profile ? "Profil neu erstellen" : "Unternehmen analysieren"}
      pendingLabel="Erstellt …"
      hint="Das dauert meist 10 bis 30 Sekunden."
      variant={profile ? "outline" : "default"}
    />
  );

  if (!profile) {
    return (
      <Card className="items-center gap-3 px-4 py-12 text-center">
        <p className="font-medium">Noch kein Unternehmensprofil</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Das Profil fasst Leistungen und Alleinstellungsmerkmale mit Quelle und Sicherheit je Aussage zusammen.
          Was nicht belegt ist, erscheint als Platzhalter zum Nachfragen.
        </p>
        {button}
      </Card>
    );
  }

  const verified = profile.facts.filter((f) => f.status === "verified").length;

  return (
    <div className="flex flex-col gap-4">
      <Card className="gap-2 px-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Erstellt am {formatDateTime(profile.generated_at)} ·{" "}
            {profile.used_website_text ? "Stammdaten und Website-Text" : "nur Stammdaten (keine Website analysiert)"}
            {profile.model_used ? ` · ${profile.model_used}` : ""}
          </p>
          {button}
        </div>
        <p className="text-sm">
          <span className="font-semibold">{verified}</span> von {profile.facts.length} Aussagen sind belegt, der Rest
          ist als Platzhalter markiert und muss mit dem Betrieb bestätigt werden.
        </p>
      </Card>

      <Card className="gap-3 overflow-x-auto px-4">
        <SectionTitle>Aussagen</SectionTitle>
        {profile.facts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Aussagen vorhanden.</p>
        ) : (
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3 font-semibold">Aussage</th>
                <th className="px-3 py-2 font-semibold">Art</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Quelle</th>
                <th className="py-2 pl-3 font-semibold">Sicherheit</th>
              </tr>
            </thead>
            <tbody>
              {profile.facts.map((fact, index) => (
                <tr key={index} className="border-b last:border-b-0 align-top">
                  <td className="py-2 pr-3">{fact.claim}</td>
                  <td className="px-3 py-2 text-muted-foreground">{FACT_CATEGORY_LABELS[fact.category]}</td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold",
                        fact.status === "verified"
                          ? "bg-success-soft text-success"
                          : "bg-warning-soft text-warning",
                      )}
                    >
                      {fact.status === "verified" ? "Belegt" : "Platzhalter"}
                    </span>
                  </td>
                  <td className="px-3 py-2">{SOURCE_LABELS[fact.source]}</td>
                  <td className="py-2 pl-3">{CONFIDENCE_LABELS[fact.confidence]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="gap-3 px-4">
          <SectionTitle>Empfohlene Leistungen</SectionTitle>
          <ul className="flex flex-wrap gap-2">
            {profile.recommended_services.map((service) => (
              <li key={service} className="rounded-md bg-muted px-2.5 py-1 text-sm">
                {service}
              </li>
            ))}
          </ul>
          <SectionTitle>Empfohlene Handlungsaufforderungen</SectionTitle>
          <ul className="list-inside list-disc text-sm">
            {profile.recommended_ctas.map((cta) => (
              <li key={cta}>{cta}</li>
            ))}
          </ul>
        </Card>
        <Card className="gap-3 px-4">
          <SectionTitle>Empfohlene Seitenstruktur</SectionTitle>
          <ul className="flex flex-col gap-2 text-sm">
            {profile.recommended_page_structure.map((page) => (
              <li key={page.slug}>
                <span className="font-medium">{page.title}</span>{" "}
                <span className="font-mono text-xs text-muted-foreground">{page.slug}</span>
                <p className="text-xs text-muted-foreground">{page.sections.join(" · ")}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
