import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ActivityFeed } from "@/components/domain/ActivityFeed";
import { KpiCard } from "@/components/domain/KpiCard";
import { PageHeader } from "@/components/domain/PageHeader";
import { TodayList } from "@/components/domain/TodayList";
import { LEAD_STATUS_LABELS, LEAD_STATUS_VALUES } from "@/lib/leads/constants";
import { getDashboardStats, getDueTasks, getRecentActivity } from "@/lib/leads/queries";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{children}</h2>
  );
}

// Demos, Kunden, MRR und Umsatz zeigen "—", bis die zugehörigen Milestones (4, 6, 8) Daten liefern.
export default async function DashboardPage() {
  const [stats, dueTasks, activity] = await Promise.all([
    getDashboardStats(),
    getDueTasks(),
    getRecentActivity(),
  ]);

  return (
    <>
      <PageHeader title="Dashboard" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Neue Leads · 7 Tage" value={String(stats.newLeads7d)} />
        <KpiCard label="Demos erstellt · 7 Tage" value="—" />
        <KpiCard label="Aktive Kunden" value="—" />
        <KpiCard label="MRR" value="—" />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <KpiCard size="small" label="Projektumsatz · Monat" value="—" />
        <KpiCard size="small" label="Ø Projektwert" value="—" />
        <KpiCard
          size="small"
          label="Verlorene Leads · Monat"
          value={String(stats.lostThisMonth)}
        />
      </div>

      <Card className="mt-6 px-4">
        <SectionTitle>Pipeline</SectionTitle>
        <ul className="flex flex-wrap gap-2">
          {LEAD_STATUS_VALUES.map((status) => (
            <li key={status}>
              <Link
                href={`/leads?status=${status}`}
                className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              >
                {LEAD_STATUS_LABELS[status]}
                <span className="font-mono font-semibold tabular-nums text-muted-foreground">
                  {stats.countsByStatus[status] ?? 0}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-6 grid gap-3 lg:grid-cols-[3fr_2fr]">
        <Card className="px-4">
          <SectionTitle>Heute fällig</SectionTitle>
          <TodayList tasks={dueTasks} />
        </Card>
        <Card className="px-4">
          <SectionTitle>Aktivität</SectionTitle>
          <ActivityFeed entries={activity} />
        </Card>
      </div>
    </>
  );
}
