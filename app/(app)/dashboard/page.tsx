import { Card } from "@/components/ui/card";
import { KpiCard } from "@/components/domain/KpiCard";
import { PageHeader } from "@/components/domain/PageHeader";

const pipelineStages = [
  "Neu",
  "Qualifiziert",
  "Demo erstellt",
  "Kontaktiert",
  "Interessiert",
  "Termin",
  "Angebot",
  "Gewonnen",
  "Verloren",
];

// Platzhalter-Layout: die Kennzahlen werden ab Milestone 2 aus echten Daten gespeist.
export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Neue Leads · 7 Tage" value="—" />
        <KpiCard label="Demos erstellt · 7 Tage" value="—" />
        <KpiCard label="Aktive Kunden" value="—" />
        <KpiCard label="MRR" value="—" />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <KpiCard size="small" label="Projektumsatz · Monat" value="—" />
        <KpiCard size="small" label="Ø Projektwert" value="—" />
        <KpiCard size="small" label="Verlorene Leads · Monat" value="—" />
      </div>

      <Card className="mt-6 px-4">
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Pipeline
        </h2>
        <ul className="flex flex-wrap gap-2">
          {pipelineStages.map((stage) => (
            <li
              key={stage}
              className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-sm"
            >
              {stage}
              <span className="font-mono font-semibold tabular-nums text-muted-foreground">
                —
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-6 grid gap-3 lg:grid-cols-[3fr_2fr]">
        <Card className="px-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Heute fällig
          </h2>
          <p className="text-sm text-muted-foreground">
            Keine fälligen Aufgaben.
          </p>
        </Card>
        <Card className="px-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Aktivität
          </h2>
          <p className="text-sm text-muted-foreground">Noch keine Aktivität.</p>
        </Card>
      </div>
    </>
  );
}
