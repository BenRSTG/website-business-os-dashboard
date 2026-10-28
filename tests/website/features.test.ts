import { describe, expect, it } from "vitest";
import { parseSections } from "@/lib/website/content/schemas";
import { FEATURES, normalizeFeatures, needsFeatureCopy, type Feature } from "@/lib/website/features";
import { assemble, executeAiStep, type RunAi, type RunState } from "@/lib/website/pipeline";
import { featureCopySchema } from "@/lib/website/prompts";
import { findUnbackedClaims } from "@/lib/website/quality";
import { featureCopy, home, lead, leistungen, plan, profile, seo } from "./helpers";

const base: RunState = { plan, home, leistungen, seo };
const subsets = (list: readonly Feature[]): Feature[][] =>
  list.reduce<Feature[][]>((acc, f) => [...acc, ...acc.map((s) => [...s, f])], [[]]);

const typesOf = (pageSlug: string, r: ReturnType<typeof assemble>) =>
  r.pages.find((p) => p.slug === pageSlug)!.sections.map((s) => s.component_type);

describe("Feature-Auswahl", () => {
  it("normalisiert: unbekannte und doppelte Werte entfallen, Reihenfolge der Oberfläche", () => {
    expect(normalizeFeatures(["booking_request", "map", "map", "quatsch", 3])).toEqual(["map", "booking_request"]);
    expect(normalizeFeatures("map")).toEqual([]);
    expect(normalizeFeatures(undefined)).toEqual([]);
  });

  it("nur die Karte braucht keinen KI-Text", () => {
    expect(needsFeatureCopy([])).toBe(false);
    expect(needsFeatureCopy(["map"])).toBe(false);
    expect(needsFeatureCopy(["map", "gallery"])).toBe(true);
  });

  it("alle 32 Kombinationen ergeben gültige Seiten ohne Fehler im Bericht", () => {
    for (const features of subsets(FEATURES)) {
      const r = assemble(lead, profile, { ...base, features, featureCopy: needsFeatureCopy(features) ? featureCopy : null });
      expect(r.report.errors, features.join()).toEqual([]);
      for (const page of r.pages) expect(parseSections(page.sections).every((x) => x.ok), `${features.join()} ${page.slug}`).toBe(true);
    }
  });

  it("jede Auswahl fügt genau ihre Abschnitte auf der richtigen Seite ein", () => {
    const only = (f: Feature) => assemble(lead, profile, { ...base, features: [f], featureCopy });
    expect(typesOf("/kontakt", only("map"))).toContain("location");
    expect(typesOf("/kontakt", only("hours_area"))).toEqual(["navbar", "contact", "hours", "footer"]);
    expect(typesOf("/kontakt", only("booking_request"))).toEqual(["navbar", "contact", "booking", "footer"]);
    expect(typesOf("/", only("gallery"))).toContain("gallery");
    expect(typesOf("/", only("pricing_team"))).toContain("team");
    expect(typesOf("/leistungen", only("pricing_team"))).toContain("pricing");
    expect(typesOf("/", only("hours_area"))).not.toContain("gallery");
  });

  it("ohne Auswahl entsteht keine Karte und kein Zusatzbaustein", () => {
    const r = assemble(lead, profile, { ...base, features: [], featureCopy: null });
    const all = r.pages.flatMap((p) => p.sections.map((s) => s.component_type));
    for (const t of ["location", "hours", "gallery", "pricing", "team", "booking"]) expect(all).not.toContain(t);
  });

  it("ohne Angabe gilt der Standard (nur Karte)", () => {
    const r = assemble(lead, profile, base);
    expect(typesOf("/kontakt", r)).toEqual(["navbar", "contact", "location", "footer"]);
  });

  it("Preise sind immer Platzhalter, auch wenn die KI Zahlen schreibt", () => {
    const r = assemble(lead, profile, { ...base, features: ["pricing_team"], featureCopy });
    const pricing = r.pages.find((p) => p.slug === "/leistungen")!.sections.find((s) => s.component_type === "pricing");
    expect(pricing?.component_type === "pricing" && pricing.content.items.every((i) => i.price === "[Preis ergänzen]")).toBe(true);
    expect(r.report.placeholders.some((p) => p.includes("[Preis ergänzen]"))).toBe(true);
  });

  it("Team: Ansprechpartner aus den Stammdaten, weitere Personen nur als Platzhalter", () => {
    const r = assemble(lead, profile, { ...base, features: ["pricing_team"], featureCopy });
    const team = r.pages[0].sections.find((s) => s.component_type === "team");
    expect(team?.component_type === "team" && team.content.members.map((m) => m.name)).toEqual(["Herr Weber", "[Name ergänzen]"]);
    const noName = assemble({ ...lead, contact_name: null }, profile, { ...base, features: ["pricing_team"], featureCopy });
    const t2 = noName.pages[0].sections.find((s) => s.component_type === "team");
    expect(t2?.component_type === "team" && t2.content.members[0].name).toBe("[Name ergänzen]");
  });

  it("Öffnungszeiten und Einsatzgebiet: ohne belegte Angabe Platzhalter, mit belegter Angabe wörtlich", () => {
    const empty = assemble(lead, profile, { ...base, features: ["hours_area"], featureCopy });
    expect(empty.report.placeholders.some((p) => p.includes("[bitte ergänzen]"))).toBe(true);
    expect(empty.report.placeholders.some((p) => p.includes("[Einsatzgebiet ergänzen]"))).toBe(true);

    const filled = assemble(lead, profile, {
      ...base,
      features: ["hours_area"],
      featureCopy: { ...featureCopy, opening_hours: [{ days: "Montag bis Freitag", hours: "8 bis 12 Uhr" }], service_area: "Lahr" },
    });
    expect(filled.report.placeholders.some((p) => p.includes("[bitte ergänzen]"))).toBe(false);
    // Zahlen, die in keinem verifizierten Fakt stehen, erscheinen als Hinweis im Bericht:
    expect(filled.report.warnings.some((w) => w.includes("Zahl"))).toBe(true);
  });

  it("erfundene Preise oder Zahlen in den Baustein-Texten werden als Hinweis gemeldet", () => {
    const risky = { ...featureCopy, pricing_intro: "Kleinaufträge ab 49 € mit 2 Jahren Garantie." };
    const r = assemble(lead, profile, { ...base, features: ["pricing_team"], featureCopy: risky });
    expect(r.report.warnings.join(" ")).toMatch(/49/);
    expect(r.report.warnings.join(" ")).toMatch(/garantie/);
    expect(findUnbackedClaims("Termin nach Rücksprache", lead, profile.facts)).toEqual([]);
  });

  it("Datenschutz-Vorlage: Karte und Terminanfrage ergeben jeweils ihren Abschnitt", () => {
    const headings = (features: Feature[]) => {
      const r = assemble(lead, profile, { ...base, features, featureCopy });
      const legal = r.pages.find((p) => p.slug === "/datenschutz")!.sections.find((s) => s.component_type === "legal");
      return legal?.component_type === "legal" ? (legal.content.sections ?? []).map((s) => s.heading) : [];
    };
    expect(headings(["map"])).toContain("Karten und externe Inhalte");
    expect(headings(["map"])).not.toContain("Terminanfragen");
    expect(headings(["booking_request"])).toContain("Terminanfragen");
    expect(headings(["booking_request"])).not.toContain("Karten und externe Inhalte");
    expect(headings([])).toEqual(["Hosting", "Kontaktaufnahme", "Ihre ​Rechte".replace("​", "")]);
  });
});

describe("Schritt copy_features", () => {
  it("ohne textpflichtige Bausteine: kein KI-Aufruf, keine Kosten", async () => {
    let calls = 0;
    const runAi: RunAi = async () => {
      calls++;
      throw new Error("darf nicht aufgerufen werden");
    };
    for (const features of [[], ["map"]] as Feature[][]) {
      const out = await executeAiStep("copy_features", { lead, profile, state: { ...base, features }, runAi });
      expect(out.costEur).toBe(0);
      expect(out.state.featureCopy).toBeNull();
    }
    expect(calls).toBe(0);
  });

  it("mit Bausteinen: ein Aufruf mit den gewählten Bausteinen, ohne Kontaktdaten", async () => {
    let seen = { userText: "", tier: "" };
    const runAi: RunAi = async (args) => {
      seen = { userText: args.userText, tier: args.tier };
      return { output: args.schema.parse(featureCopy) as never, costEur: 0.03 };
    };
    const out = await executeAiStep("copy_features", { lead, profile, state: { ...base, features: ["map", "gallery", "booking_request"] }, runAi });
    expect(out.costEur).toBe(0.03);
    expect(seen.tier).toBe("capable");
    expect(seen.userText).toContain("Galerie / Referenzen");
    expect(seen.userText).toContain("Terminanfrage");
    expect(seen.userText).not.toContain("Karte und Anfahrt");
    expect(seen.userText).not.toContain(lead.phone!);
    expect(seen.userText).not.toContain("Hauptstraße");
  });

  it("verlangt vorhandene Texte", async () => {
    const runAi: RunAi = async () => ({ output: {} as never, costEur: 0 });
    await expect(executeAiStep("copy_features", { lead, profile, state: { features: ["gallery"] }, runAi })).rejects.toThrow(/Texte fehlen/);
  });

  it("Ausgabeformat: Felder nicht gewählter Bausteine dürfen null sein", () => {
    const nulls = { ...featureCopy, hours_headline: null, gallery_headline: null, pricing_items: [], opening_hours: [] };
    expect(featureCopySchema.safeParse(nulls).success).toBe(true);
    expect(featureCopySchema.safeParse({ ...featureCopy, pricing_items: Array(4).fill(featureCopy.pricing_items[0]) }).success).toBe(false);
  });
});
