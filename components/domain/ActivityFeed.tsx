import Link from "next/link";
import { formatDateTime } from "@/lib/datetime";
import { LEAD_STATUS_LABELS } from "@/lib/leads/constants";
import type { ActivityEntry } from "@/lib/leads/types";

function describe(entry: ActivityEntry): string {
  const name = entry.input?.company_name ?? "Lead";
  if (entry.action_type === "lead.created") return `Neuer Lead: ${name}`;
  if (entry.action_type === "lead.status_changed" && entry.input?.to) {
    return `Status → ${LEAD_STATUS_LABELS[entry.input.to]}: ${name}`;
  }
  return name;
}

export function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Noch keine Aktivität.</p>;
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {entries.map((entry) => (
        <li key={entry.id} className="flex gap-2.5 text-sm">
          <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
          <div className="min-w-0">
            <Link
              href={`/leads/${entry.entity_id}`}
              className="rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              {describe(entry)}
            </Link>
            <p className="text-xs text-muted-foreground">{formatDateTime(entry.created_at)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
