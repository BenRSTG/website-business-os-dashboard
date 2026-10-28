import Link from "next/link";
import { Card } from "@/components/ui/card";
import { DemoAccess } from "@/components/domain/DemoAccess";
import { DemoRunner } from "@/components/domain/DemoRunner";
import { formatDate, formatDateTime } from "@/lib/datetime";
import type { CompanyProfileRow } from "@/lib/intelligence/types";
import { isExpired, isResumable, previewUrl, type DemoSite, type GenerationRun } from "@/lib/website/queries";
import { normalizeFeatures } from "@/lib/website/features";
import { PACKAGE_LABELS, normalizePackage } from "@/lib/website/packages";
import { type StepId } from "@/lib/website/steps";

const STYLE_LABELS = { modern: "Modern", traditional: "Klassisch", premium: "Hochwertig" } as const;

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{children}</h2>;
}

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-sm font-semibold">
        {title} ({items.length})
      </p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function DemoPanel({
  leadId,
  profile,
  run,
  sites,
}: {
  leadId: string;
  profile: CompanyProfileRow | null;
  run: GenerationRun | null;
  sites: DemoSite[];
}) {
  if (!profile) {
    return (
      <Card className="items-center gap-3 px-4 py-12 text-center">
        <p className="font-medium">Zuerst das Unternehmensprofil erstellen</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Die Demo baut auf den belegten Fakten des Profils auf. Ohne Profil gäbe es nur erfundene Inhalte.
        </p>
        <Link href={`/leads/${leadId}?tab=profil`} className="text-sm font-medium text-primary underline-offset-2 hover:underline">
          Zum Unternehmensprofil
        </Link>
      </Card>
    );
  }

  const site = run?.status === "DONE" && run.site_id ? sites.find((s) => s.id === run.site_id) : undefined;
  const resumable = isResumable(run);
  const report = run?.status === "DONE" ? run.quality_report : null;
  const manualSites = sites.filter((s) => s.id !== run?.site_id);

  return (
    <div className="flex flex-col gap-4">
      {site && site.preview_slug ? (
        <Card className="gap-3 px-4">
          <SectionTitle>Aktuelle Demo</SectionTitle>
          <p className="text-sm">
            Paket: <span className="font-semibold">{PACKAGE_LABELS[normalizePackage(site.package)]}</span> · Stil: <span className="font-semibold">{STYLE_LABELS[site.style]}</span> · erstellt am {formatDateTime(site.created_at)} · KI-Kosten{" "}
            {Number(run?.cost_total_eur ?? 0).toFixed(2).replace(".", ",")} €
          </p>
          <a
            href={previewUrl(site.preview_slug)}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-sm font-medium text-primary underline-offset-2 hover:underline"
          >
            {previewUrl(site.preview_slug)}
          </a>
          <p className="text-xs text-muted-foreground">Entwurf mit Hinweisband, für Suchmaschinen gesperrt.</p>
          <DemoAccess
            siteId={site.id}
            link={previewUrl(site.preview_slug)}
            protectedByPassword={site.preview_protected}
            expiresLabel={site.preview_expires_at ? formatDate(site.preview_expires_at) : null}
            expired={isExpired(site.preview_expires_at)}
          />
        </Card>
      ) : null}

      {report ? (
        <Card className="gap-3 px-4">
          <SectionTitle>Qualitätsbericht</SectionTitle>
          <List title="Bitte vor dem Zeigen prüfen" items={report.warnings} />
          <List title="Offene Platzhalter" items={report.placeholders} />
          {report.warnings.length === 0 && report.placeholders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Auffälligkeiten.</p>
          ) : null}
        </Card>
      ) : null}

      {run?.status === "FAILED" ? (
        <Card className="gap-2 px-4">
          <SectionTitle>Letzter Lauf fehlgeschlagen</SectionTitle>
          <p role="alert" className="text-sm text-destructive">
            {run.error_message ?? "Unbekannter Fehler."}
          </p>
          <p className="text-xs text-muted-foreground">Bisherige KI-Kosten dieses Laufs: {Number(run.cost_total_eur).toFixed(2).replace(".", ",")} €</p>
        </Card>
      ) : null}

      {manualSites.length > 0 ? (
        <Card className="gap-2 px-4">
          <SectionTitle>Weitere Websites zu diesem Lead</SectionTitle>
          <ul className="text-sm">
            {manualSites.map((s) => (
              <li key={s.id}>
                {s.preview_slug ? (
                  <a href={previewUrl(s.preview_slug)} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">
                    {s.preview_slug}
                  </a>
                ) : (
                  "ohne Vorschau-Adresse"
                )}{" "}
                <span className="text-muted-foreground">· {s.status}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="gap-3 px-4">
        {resumable && run ? (
          <>
            <p className="text-sm">Ein Lauf wurde unterbrochen (bisher {Number(run.cost_total_eur).toFixed(2).replace(".", ",")} €). Er kann fortgesetzt werden.</p>
            {run.error_message ? <p className="text-sm text-destructive">{run.error_message}</p> : null}
            <DemoRunner leadId={leadId} label="Fortsetzen" resume={{ runId: run.id, step: run.current_step as StepId }} />
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {site
                ? "Eine neue Demo ersetzt die bisherige erst, wenn sie vollständig fertig ist."
                : "Aus Unternehmensprofil und Stammdaten entsteht ein Website-Entwurf mit fünf Seiten und eigener Vorschau-Adresse."}
            </p>
            <DemoRunner
              leadId={leadId}
              label={site ? "Demo neu erzeugen" : "Website-Demo erstellen"}
              variant={site ? "outline" : "default"}
              defaultFeatures={site ? normalizeFeatures(site.features) : undefined}
              defaultPackage={site ? normalizePackage(site.package) : undefined}
              confirmText="Die bisherige Demo wird durch die neue ersetzt, sobald diese fertig ist, und ihr Link funktioniert danach nicht mehr. Fortfahren?"
            />
          </>
        )}
      </Card>
    </div>
  );
}
