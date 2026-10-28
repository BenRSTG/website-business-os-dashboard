"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PasswordReveal } from "@/components/domain/PasswordReveal";
import { advanceDemoRun, startDemoRun } from "@/lib/website/actions";
import { DEFAULT_FEATURES, FEATURES, FEATURE_HINTS, FEATURE_LABELS, type Feature } from "@/lib/website/features";
import { DEFAULT_PACKAGE, PACKAGES, PACKAGE_HINTS, PACKAGE_LABELS, allowedFeatures, restrictFeatures, type SitePackage } from "@/lib/website/packages";
import { STEPS, STEP_LABELS, type StepId } from "@/lib/website/steps";

// Der Browser führt den Lauf Schritt für Schritt aus: jeder Schritt ist ein eigener, kurzer Server-Aufruf.
// So gibt es keine Zeitlimit-Probleme, der Fortschritt ist sichtbar, und ein Abbruch lässt sich fortsetzen.
export function DemoRunner({
  leadId,
  label,
  confirmText,
  resume,
  variant = "default",
  defaultFeatures,
  defaultPackage,
}: {
  leadId: string;
  label: string;
  /** Rückfrage vor dem Start (z. B. wenn eine bestehende Demo ersetzt wird) */
  confirmText?: string;
  /** Unterbrochener Lauf, der fortgesetzt werden kann */
  resume?: { runId: string; step: StepId };
  variant?: "default" | "outline";
  /** Vorbelegung der Feature-Auswahl (bei „Neu erzeugen“ die letzte Auswahl) */
  defaultFeatures?: Feature[];
  defaultPackage?: SitePackage;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState<StepId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pkg, setPkg] = useState<SitePackage>(defaultPackage ?? DEFAULT_PACKAGE);
  const [style, setStyle] = useState<string>("auto");
  const [scheme, setScheme] = useState<string>("auto");
  const [features, setFeatures] = useState<Feature[]>(restrictFeatures(defaultFeatures ?? DEFAULT_FEATURES, defaultPackage ?? DEFAULT_PACKAGE));
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
        const started = await startDemoRun(leadId, {
          features: restrictFeatures(features, pkg),
          package: pkg,
          style: style === "auto" ? null : style,
          scheme: scheme === "auto" ? null : scheme,
        });
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
      {!resume && !running ? (
        <div className="flex w-full flex-col gap-4">
          <fieldset>
            <legend className="text-sm font-semibold">Paket</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {PACKAGES.map((p) => (
                <label
                  key={p}
                  className={`flex cursor-pointer flex-col gap-0.5 rounded-md border p-3 text-sm ${pkg === p ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <input
                      type="radio"
                      name="paket"
                      className="size-4 accent-[var(--primary)]"
                      checked={pkg === p}
                      onChange={() => {
                        setPkg(p);
                        setFeatures((current) => restrictFeatures(current, p));
                      }}
                    />
                    {PACKAGE_LABELS[p]}
                  </span>
                  <span className="text-xs text-muted-foreground">{PACKAGE_HINTS[p]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Stil
              <select value={style} onChange={(e) => setStyle(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm font-normal">
                <option value="auto">Automatisch (KI entscheidet)</option>
                <option value="modern">Modern</option>
                <option value="traditional">Klassisch</option>
                <option value="premium">Hochwertig</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Farbwelt
              <select value={scheme} onChange={(e) => setScheme(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm font-normal">
                <option value="auto">Automatisch (KI entscheidet)</option>
                <option value="light">Hell</option>
                <option value="dark">Dunkel</option>
              </select>
            </label>
          </div>

          <fieldset>
            <legend className="text-sm font-semibold">Gewünschte Bausteine</legend>
            <ul className="mt-2 flex flex-col gap-2">
              {FEATURES.map((feature) => {
                const included = allowedFeatures(pkg).includes(feature);
                return (
                  <li key={feature}>
                    <label className={`flex items-start gap-2 text-sm ${included ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
                      <input
                        type="checkbox"
                        className="mt-0.5 size-4 accent-[var(--primary)]"
                        disabled={!included}
                        checked={included && features.includes(feature)}
                        onChange={(e) =>
                          setFeatures((current) => (e.target.checked ? [...current, feature] : current.filter((f) => f !== feature)))
                        }
                      />
                      <span>
                        {FEATURE_LABELS[feature]}
                        <span className="block text-xs text-muted-foreground">
                          {included ? FEATURE_HINTS[feature] : `Nicht im Paket ${PACKAGE_LABELS[pkg]} enthalten (ab Profi).`}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        </div>
      ) : null}
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
