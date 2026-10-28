import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  LEAD_INDUSTRY_LABELS,
  LEAD_INDUSTRY_VALUES,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_VALUES,
} from "@/lib/leads/constants";
import type { LeadFilters as Filters } from "@/lib/leads/queries";

// Reines GET-Formular: Filter stehen in der URL, die Seite bleibt teilbar und braucht kein Client-JS.
export function LeadFilters({
  view,
  filters,
}: {
  view: "list" | "pipeline";
  filters: Filters;
}) {
  return (
    <form method="get" action="/leads" className="mb-4 flex flex-wrap items-end gap-2">
      <input type="hidden" name="view" value={view} />
      {view === "list" ? (
        <label className="flex min-w-40 flex-col gap-1 text-xs font-medium text-muted-foreground">
          Status
          <NativeSelect name="status" defaultValue={filters.status ?? ""}>
            <option value="">Alle</option>
            {LEAD_STATUS_VALUES.map((value) => (
              <option key={value} value={value}>
                {LEAD_STATUS_LABELS[value]}
              </option>
            ))}
          </NativeSelect>
        </label>
      ) : null}
      <label className="flex min-w-44 flex-col gap-1 text-xs font-medium text-muted-foreground">
        Branche
        <NativeSelect name="industry" defaultValue={filters.industry ?? ""}>
          <option value="">Alle</option>
          {LEAD_INDUSTRY_VALUES.map((value) => (
            <option key={value} value={value}>
              {LEAD_INDUSTRY_LABELS[value]}
            </option>
          ))}
        </NativeSelect>
      </label>
      <label className="flex min-w-40 flex-col gap-1 text-xs font-medium text-muted-foreground">
        Ort
        <Input name="city" defaultValue={filters.city ?? ""} placeholder="z. B. Freiburg" />
      </label>
      <Button type="submit" variant="secondary">
        Filtern
      </Button>
      <Link href={`/leads?view=${view}`} className={buttonVariants({ variant: "ghost" })}>
        Zurücksetzen
      </Link>
    </form>
  );
}
