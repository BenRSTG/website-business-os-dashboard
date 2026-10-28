import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AuditPanel } from "@/components/domain/AuditPanel";
import { DemoPanel } from "@/components/domain/DemoPanel";
import { ProfilePanel } from "@/components/domain/ProfilePanel";
import { SalesActions } from "@/components/domain/SalesActions";
import { ScoreBadge } from "@/components/domain/ScoreBadge";
import { StatusBadge } from "@/components/domain/StatusBadge";
import { StatusSelect } from "@/components/domain/StatusSelect";
import { formatDate, formatDateTime } from "@/lib/datetime";
import {
  LEAD_INDUSTRY_LABELS,
  LEAD_SOURCE_LABELS,
  TASK_CONTACT_TYPE_LABELS,
  TASK_RESULT_LABELS,
  nextActionFor,
} from "@/lib/leads/constants";
import { completeTask } from "@/lib/leads/actions";
import {
  getLatestAudit,
  getLatestProfile,
  getLatestScores,
  getScoringConfig,
} from "@/lib/intelligence/queries";
import { getLead, getLeadTasks } from "@/lib/leads/queries";
import { getDemoSites, getLatestRun } from "@/lib/website/queries";
import type { Lead } from "@/lib/leads/types";
import { cn } from "@/lib/utils";

const tabs = [
  { value: "uebersicht", label: "Übersicht" },
  { value: "audit", label: "Audit & Score" },
  { value: "profil", label: "Unternehmensprofil" },
  { value: "demos", label: "Demos" },
] as const;
type TabValue = (typeof tabs)[number]["value"];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{children}</h2>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm">{children}</dd>
    </div>
  );
}

function ExternalLink({ href }: { href: string | null }) {
  if (!href) return <>—</>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline-offset-2 hover:underline"
    >
      {href.replace(/^https?:\/\//, "")}
    </a>
  );
}

function Overview({ lead }: { lead: Lead }) {
  const address = [lead.address_street, [lead.address_zip, lead.address_city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="flex flex-col gap-4">
      <Card className="gap-4 px-4">
        <SectionTitle>Stammdaten</SectionTitle>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Fact label="Ansprechpartner">{lead.contact_name ?? "—"}</Fact>
          <Fact label="Telefon">{lead.phone ?? "—"}</Fact>
          <Fact label="E-Mail">{lead.email ?? "—"}</Fact>
          <Fact label="Adresse">{address || "—"}</Fact>
          <Fact label="Bestehende Website">
            <ExternalLink href={lead.existing_website_url} />
          </Fact>
          <Fact label="Google-Profil">
            <ExternalLink href={lead.google_profile_url} />
          </Fact>
          <Fact label="Google-Bewertung">
            {lead.google_rating !== null
              ? `${lead.google_rating.toString().replace(".", ",")} Sterne${
                  lead.google_rating_count !== null ? ` (${lead.google_rating_count} Bewertungen)` : ""
                }`
              : "—"}
          </Fact>
          <Fact label="Quelle">{LEAD_SOURCE_LABELS[lead.source]}</Fact>
          <Fact label="Angelegt am">{formatDate(lead.created_at)}</Fact>
          {lead.reactivation_count > 0 ? (
            <Fact label="Reaktiviert">
              {lead.reactivation_count}× (zuletzt {formatDate(lead.reactivated_at)})
            </Fact>
          ) : null}
        </dl>
      </Card>
      <Card className="gap-2 px-4">
        <SectionTitle>Notizen</SectionTitle>
        <p className="whitespace-pre-wrap text-sm">
          {lead.notes ?? <span className="text-muted-foreground">Keine Notizen.</span>}
        </p>
      </Card>
    </div>
  );
}

// Website-Analyse (PageSpeed + KI) und einzelne Schritte der Demo-Erstellung können länger als die Standardlaufzeit brauchen.
export const maxDuration = 120;

export default async function LeadDetailPage({
  params,
  searchParams,
}: PageProps<"/leads/[leadId]">) {
  const { leadId } = await params;
  const query = await searchParams;
  const lead = await getLead(leadId);
  if (!lead) notFound();

  const requestedTab = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  const tab: TabValue = tabs.some((t) => t.value === requestedTab)
    ? (requestedTab as TabValue)
    : "uebersicht";

  const [tasks, scores, config, audit, profile, demoRun, demoSites] = await Promise.all([
    getLeadTasks(lead.id),
    getLatestScores(lead.id),
    getScoringConfig(),
    tab === "audit" ? getLatestAudit(lead.id) : Promise.resolve(null),
    tab === "profil" || tab === "demos" ? getLatestProfile(lead.id) : Promise.resolve(null),
    tab === "demos" ? getLatestRun(lead.id) : Promise.resolve(null),
    tab === "demos" ? getDemoSites(lead.id) : Promise.resolve([]),
  ]);
  const openTasks = tasks
    .filter((t) => t.status === "OPEN")
    .sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""));
  const history = tasks.filter((t) => t.status === "DONE");
  const nextAction = nextActionFor(lead.status);

  return (
    <>
      <Link
        href="/leads"
        className="mb-3 inline-block rounded-sm text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        ← Zurück zu Leads
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold">{lead.company_name}</h1>
            <StatusBadge status={lead.status} />
            {scores ? (
              <ScoreBadge
                score={scores.sales_opportunity_score}
                reachable={scores.reachable}
                config={config}
                showLabel
              />
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {LEAD_INDUSTRY_LABELS[lead.industry]}
            {lead.address_city ? ` · ${lead.address_city}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusSelect leadId={lead.id} status={lead.status} className="w-44" />
          <Link href={`/leads/${lead.id}/edit`} className={buttonVariants({ variant: "outline" })}>
            <Pencil aria-hidden /> Bearbeiten
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          <nav aria-label="Lead-Bereiche" className="mb-4 flex gap-5 overflow-x-auto border-b">
            {tabs.map(({ value, label }) => (
              <Link
                key={value}
                href={`/leads/${lead.id}?tab=${value}`}
                aria-current={tab === value ? "page" : undefined}
                className={cn(
                  "-mb-px whitespace-nowrap border-b-2 px-0.5 pb-2.5 pt-1 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  tab === value
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </Link>
            ))}
          </nav>

          {tab === "uebersicht" ? <Overview lead={lead} /> : null}
          {tab === "audit" ? <AuditPanel lead={lead} audit={audit} scores={scores} /> : null}
          {tab === "profil" ? <ProfilePanel leadId={lead.id} profile={profile} /> : null}
          {tab === "demos" ? <DemoPanel leadId={lead.id} profile={profile} run={demoRun} sites={demoSites} /> : null}
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="gap-3 px-4">
            <SectionTitle>Nächste Aktion</SectionTitle>
            <p className="text-sm font-medium">{nextAction ?? "—"}</p>
            <p className="text-xs text-muted-foreground">
              Nächster Kontakt: {formatDate(lead.next_contact_at)}
            </p>
            <SalesActions
              leadId={lead.id}
              companyName={lead.company_name}
              contactName={lead.contact_name}
              phone={lead.phone}
              email={lead.email}
            />
          </Card>

          {openTasks.length > 0 ? (
            <Card className="gap-3 px-4">
              <SectionTitle>Offene Aufgaben</SectionTitle>
              <ul className="divide-y">
                {openTasks.map((task) => (
                  <li key={task.id} className="flex items-center gap-2 py-2">
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-medium">
                        {TASK_CONTACT_TYPE_LABELS[task.contact_type]} · {formatDateTime(task.due_at)}
                      </p>
                      {task.note ? (
                        <p className="truncate text-xs text-muted-foreground">{task.note}</p>
                      ) : null}
                    </div>
                    <form action={completeTask.bind(null, task.id)}>
                      <Button type="submit" variant="outline" size="sm">
                        Erledigt
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card className="gap-3 px-4">
            <SectionTitle>Kontaktverlauf</SectionTitle>
            <ul className="flex flex-col gap-3">
              {history.map((task) => (
                <li key={task.id} className="text-sm">
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(task.completed_at)}
                  </p>
                  <p>
                    {TASK_CONTACT_TYPE_LABELS[task.contact_type]}
                    {task.result ? ` · ${TASK_RESULT_LABELS[task.result]}` : ""}
                  </p>
                  {task.note ? (
                    <p className="whitespace-pre-wrap text-xs text-muted-foreground">{task.note}</p>
                  ) : null}
                </li>
              ))}
              <li className="text-sm">
                <p className="text-xs text-muted-foreground">{formatDateTime(lead.created_at)}</p>
                <p>Lead angelegt</p>
              </li>
            </ul>
          </Card>
        </aside>
      </div>
    </>
  );
}
