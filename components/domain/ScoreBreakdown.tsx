import type { FactorResult, ModifierResult } from "@/lib/scoring/compute";

const fmt = (n: number) => n.toFixed(1).replace(".", ",");

function Factors({ factors }: { factors: FactorResult[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {factors.map((factor) => (
        <li key={factor.key} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
          <span>
            {factor.label}
            <span className="ml-1.5 text-xs text-muted-foreground">
              {Math.round(factor.weight * 100)} %
              {factor.note ? ` · ${factor.note}` : ""}
            </span>
          </span>
          <span className="font-mono tabular-nums">
            {factor.measured ? Math.round(factor.value) : "—"}
            <span className="ml-2 text-muted-foreground">+{fmt(factor.contribution)}</span>
          </span>
          <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div
              className={factor.measured ? "h-full bg-primary" : "h-full bg-muted-foreground/30"}
              style={{ width: `${factor.measured ? factor.value : 0}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Modifiers({ modifiers }: { modifiers: ModifierResult[] }) {
  return (
    <ul className="mt-3 flex flex-col gap-1 border-t pt-3 text-sm">
      {modifiers.map((m) => (
        <li key={m.key} className="flex justify-between gap-3">
          <span className={m.applied ? undefined : "text-muted-foreground"}>{m.label}</span>
          <span className="font-mono tabular-nums">
            {m.applied ? `${m.points > 0 ? "+" : ""}${m.points}` : "nicht angewendet"}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Aufklappbare Begründung eines Scores: Einzelfaktoren mit Gewicht, Teilwert und Beitrag. */
export function ScoreBreakdown({
  title,
  score,
  factors,
  modifiers,
  emptyNote,
}: {
  title: string;
  score: number;
  factors: FactorResult[];
  modifiers?: ModifierResult[];
  emptyNote?: string;
}) {
  return (
    <details className="group rounded-xl bg-card ring-1 ring-foreground/10 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3 rounded-xl px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</span>
        <span className="flex items-baseline gap-2">
          <span className="font-mono text-2xl font-semibold tabular-nums">{score}</span>
          <span className="text-xs text-muted-foreground group-open:hidden">Begründung ▾</span>
          <span className="hidden text-xs text-muted-foreground group-open:inline">schließen ▴</span>
        </span>
      </summary>
      <div className="border-t px-4 py-3">
        {factors.length > 0 ? <Factors factors={factors} /> : <p className="text-sm text-muted-foreground">{emptyNote}</p>}
        {modifiers ? <Modifiers modifiers={modifiers} /> : null}
      </div>
    </details>
  );
}
