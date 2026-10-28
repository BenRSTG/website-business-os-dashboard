"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PasswordReveal } from "@/components/domain/PasswordReveal";
import { advanceDemoRun, startDemoRun } from "@/lib/website/actions";
import { STEPS, STEP_LABELS, type StepId } from "@/lib/website/steps";

// Der Browser führt den Lauf Schritt für Schritt aus: jeder Schritt ist ein eigener, kurzer Server-Aufruf.
// So gibt es keine Zeitlimit-Probleme, der Fortschritt ist sichtbar, und ein Abbruch lässt sich fortsetzen.
export function DemoRunner({
  leadId,
  label,
  confirmText,
  resume,
  variant = "default",
}: {
  leadId: string;
  label: string;
  /** Rückfrage vor dem Start (z. B. wenn eine bestehende Demo ersetzt wird) */
  confirmText?: string;
  /** Unterbrochener Lauf, der fortgesetzt werden kann */
  resume?: { runId: string; step: StepId };
  variant?: "default" | "outline";
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState<StepId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  async function drive(runId: string, first: StepId) {
    let current: StepId | null = first;
    while (current) {
      setStep(current);
      const result = await advanceDemoRun(runId, current);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.done) {
        setCreated(result.password ?? null);
        setWarning(result.warning ?? null);
        return;
      }
      current = result.step ?? null;
    }
  }

  async function run() {
    if (!resume && confirmText && !window.confirm(confirmText)) return;
    setRunning(true);
    setError(null);
    setCreated(null);
    setWarning(null);
    try {
      if (resume) {
        await drive(resume.runId, resume.step);
      } else {
        const started = await startDemoRun(leadId);
        if (started.error || !started.runId || !started.step) {
          setError(started.error ?? "Der Lauf konnte nicht gestartet werden.");
          return;
        }
        await drive(started.runId, started.step);
      }
    } catch {
      setError("Die Verbindung wurde unterbrochen. Bitte „Fortsetzen“ wählen oder die Seite neu laden.");
    } finally {
      setRunning(false);
      setStep(null);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <Button variant={variant} disabled={running} onClick={run}>
        {running ? "Wird erstellt …" : label}
      </Button>
      {running && step ? (
        <ol className="flex flex-col gap-1 text-sm" aria-live="polite">
          {STEPS.map((s, i) => {
            const state = STEPS.indexOf(step) > i ? "done" : s === step ? "active" : "todo";
            return (
              <li key={s} className={state === "todo" ? "text-muted-foreground" : state === "active" ? "font-semibold" : ""}>
                {state === "done" ? "✓" : state === "active" ? "…" : "·"} {STEP_LABELS[s]}
              </li>
            );
          })}
        </ol>
      ) : null}
      {running ? <p className="text-xs text-muted-foreground">Das dauert insgesamt etwa 1 bis 2 Minuten. Bitte die Seite offen lassen.</p> : null}
      {created ? <PasswordReveal password={created} onClose={() => setCreated(null)} /> : null}
      {warning ? <p className="text-sm text-muted-foreground">{warning}</p> : null}
      {error ? (
        <p role="alert" className="max-w-xl text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
