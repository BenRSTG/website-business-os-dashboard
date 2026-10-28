// Schritte der Demo-Erstellung. Eigene Datei ohne Abhängigkeiten, damit die Oberfläche sie laden kann.
export const STEPS = ["plan", "copy_home", "copy_leistungen", "copy_features", "seo", "assemble"] as const;
export type StepId = (typeof STEPS)[number];

export const STEP_LABELS: Record<StepId, string> = {
  plan: "Stil und Farben festlegen",
  copy_home: "Startseite schreiben",
  copy_leistungen: "Leistungen und Kontakt schreiben",
  copy_features: "Gewählte Bausteine schreiben",
  seo: "Titel und Beschreibungen für die Suche",
  assemble: "Seiten zusammensetzen und prüfen",
};

export function nextStep(step: StepId): StepId | null {
  return STEPS[STEPS.indexOf(step) + 1] ?? null;
}
