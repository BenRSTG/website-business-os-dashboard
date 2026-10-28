import { describe, expect, it } from "vitest";
import { parseSections } from "@/lib/website/content/schemas";
import { FEATURES, type Feature } from "@/lib/website/features";
import { initialState } from "@/lib/website/initial-state";
import { DEFAULT_OPTIONS, normalizeOptions } from "@/lib/website/options";
import { PACKAGES, allowedFeatures, requiredSlugs, restrictFeatures } from "@/lib/website/packages";
import { SCHEMES, paletteIdsFor, schemeOf, tokensFor } from "@/lib/website/palettes";
import { assemble, executeAiStep, normalizePlan, type RunAi, type RunState } from "@/lib/website/pipeline";
import { buildPlanConstraints } from "@/lib/website/prompts";
import { contrastRatio, SITE_STYLES } from "@/lib/website/tokens";
import { featureCopy, home, lead, leistungen, plan, profile, seo } from "./helpers";

const state = (pkg: "STARTER" | "BUSINESS" | "BUSINESS_PLUS", features: Feature[] = [], extra: Partial<RunState> = {}): RunState => ({
  plan,
  home,
  leistungen,
  seo,
  features,
  featureCopy: features.some((f) => f !== "map") ? featureCopy : null,
  options: { ...DEFAULT_OPTIONS, package: pkg },
  ...extra,
});

describe("Farbwelt", () => {
  it("jeder Stil hat helle und dunkle Paletten, die Farbwelt ist abfragbar", () => {
    for (const style of SITE_STYLES) {
      for (const scheme of SCHEMES) {
        const ids = paletteIdsFor(style, scheme);
        expect(ids.length, `${style} ${scheme}`).toBeGreaterThanOrEqual(1);
        for (const id of ids) expect(schemeOf(style, id)).toBe(scheme);
      }
    }
  });

  it("hell ist wirklich hell, dunkel wirklich dunkel", () => {
    for (const style of SITE_STYLES) {
      for (const scheme of SCHEMES) {
        for (const id of paletteIdsFor(style, scheme)) {
          const t = tokensFor(style, id);
          const lightBg = contrastRatio(t.background_color, "#000000") > contrastRatio(t.background_color, "#ffffff");
          expect(lightBg, id).toBe(scheme === "light");
        }
      }
    }
  });

  it("Knöpfe mit Akzent-Schrift (Stil Hochwertig) sind in jeder Palette lesbar", () => {
    for (const id of paletteIdsFor("premium")) {
      const t = tokensFor("premium", id);
      expect(contrastRatio(t.accent_color, t.background_color), id).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("Wahl von Stil und Farbwelt wird erzwungen", () => {
  it("Stil und Farbwelt des Nutzers setzen sich gegen die KI durch", () => {
    const forced = normalizePlan({ ...plan, style: "modern", palette_id: "modern-01" }, { style: "premium", scheme: "light" });
    expect(forced.style).toBe("premium");
    expect(schemeOf("premium", forced.palette_id)).toBe("light");

    const dark = normalizePlan({ ...plan, style: "traditional", palette_id: "traditional-02" }, { style: null, scheme: "dark" });
    expect(dark.style).toBe("traditional");
    expect(schemeOf("traditional", dark.palette_id)).toBe("dark");
  });

  it("passt die Palette der KI, bleibt sie; sonst die erste passende", () => {
    expect(normalizePlan({ ...plan, style: "modern", palette_id: "modern-05" }, { style: null, scheme: "dark" }).palette_id).toBe("modern-05");
    expect(normalizePlan({ ...plan, style: "modern", palette_id: "modern-02" }, { style: null, scheme: "dark" }).palette_id).toBe("modern-04");
    expect(normalizePlan({ ...plan, style: "modern", palette_id: "premium-02" }).palette_id).toBe("modern-01");
  });

  it("assemble verwendet die gewählte Farbwelt auch bei abweichender KI-Wahl", () => {
    const r = assemble(lead, profile, state("BUSINESS", [], { options: { package: "BUSINESS", style: "modern", scheme: "dark" }, plan: { ...plan, style: "traditional", palette_id: "traditional-01" } }));
    expect(r.style).toBe("modern");
    expect(schemeOf("modern", r.tokens.palette_id)).toBe("dark");
    expect(r.report.errors).toEqual([]);
  });

  it("die KI bekommt die Vorgaben, aber keine Kontaktdaten", () => {
    expect(buildPlanConstraints({ style: null, scheme: null })).toContain("du entscheidest");
    expect(buildPlanConstraints({ style: "premium", scheme: "dark" })).toMatch(/festgelegt auf "premium"[\s\S]*festgelegt auf "dunkel"/);
  });
});

describe("Pakete", () => {
  it("Optionen: Unsinn fällt auf Profi, automatisch zurück", () => {
    expect(normalizeOptions(undefined)).toEqual(DEFAULT_OPTIONS);
    expect(normalizeOptions({ package: "GOLD", style: "bunt", scheme: "neon" })).toEqual(DEFAULT_OPTIONS);
    expect(normalizeOptions({ package: "BUSINESS_PLUS", style: "premium", scheme: "dark" })).toEqual({ package: "BUSINESS_PLUS", style: "premium", scheme: "dark" });
  });

  it("Basis enthält nur Karte und Öffnungszeiten; Profi und Premium alles", () => {
    expect([...allowedFeatures("STARTER")]).toEqual(["map", "hours_area"]);
    expect([...allowedFeatures("BUSINESS")]).toEqual([...FEATURES]);
    expect([...allowedFeatures("BUSINESS_PLUS")]).toEqual([...FEATURES]);
    expect(restrictFeatures([...FEATURES], "STARTER")).toEqual(["map", "hours_area"]);
  });

  it("der Start filtert unzulässige Bausteine serverseitig", () => {
    const s = initialState({ package: "STARTER", features: ["gallery", "booking_request", "map", "unsinn"] });
    expect(s.features).toEqual(["map"]);
    expect(s.options?.package).toBe("STARTER");
    expect(initialState({}).features).toEqual(["map"]);
    expect(initialState({ package: "BUSINESS", features: [] }).features).toEqual([]);
    expect(initialState({ package: "nonsens" }).options?.package).toBe("BUSINESS");
  });

  it("Seitenumfang je Paket", () => {
    for (const pkg of PACKAGES) {
      const r = assemble(lead, profile, state(pkg, pkg === "STARTER" ? ["map", "hours_area"] : [...FEATURES]));
      expect(r.pages.map((p) => p.slug), pkg).toEqual(requiredSlugs(pkg));
      expect(r.report.errors, pkg).toEqual([]);
      for (const page of r.pages) expect(parseSections(page.sections).every((x) => x.ok), `${pkg} ${page.slug}`).toBe(true);
    }
  });

  it("Basis: eine Startseite mit Leistungen, Über uns, Zeiten, Kontakt, Karte und Sprungmarken im Menü", () => {
    const r = assemble(lead, profile, state("STARTER", ["map", "hours_area"], { featureCopy }));
    const types = r.pages[0].sections.map((s) => s.component_type);
    expect(types).toEqual(["navbar", "hero", "services", "about", "hours", "contact", "location", "footer"]);
    const nav = r.pages[0].sections[0];
    expect(nav.component_type === "navbar" && nav.content.links.map((l) => l.href)).toEqual(["/", "/#leistungen", "/#kontakt"]);
    expect(r.pages.map((p) => p.page_type)).toEqual(["home", "impressum", "datenschutz"]);
  });

  it("Basis hat keine unzulässigen Bausteine, auch wenn der Zustand sie enthielte", () => {
    const sneaky = initialState({ package: "STARTER", features: [...FEATURES] });
    const r = assemble(lead, profile, { ...state("STARTER"), ...sneaky, featureCopy });
    const all = r.pages.flatMap((p) => p.sections.map((s) => s.component_type));
    for (const t of ["gallery", "pricing", "team", "booking", "faq"]) expect(all).not.toContain(t);
  });

  it("Premium: großzügige Abstände, Profi und Basis normal", () => {
    expect(assemble(lead, profile, state("BUSINESS_PLUS")).tokens.spacing_scale).toBe("airy");
    expect(assemble(lead, profile, state("BUSINESS")).tokens.spacing_scale).toBe("normal");
    expect(assemble(lead, profile, state("STARTER")).tokens.spacing_scale).toBe("normal");
    expect(assemble(lead, profile, state("BUSINESS_PLUS")).package).toBe("BUSINESS_PLUS");
  });

  it("Basis braucht keinen Schritt für Leistungen und Kontakt (kein KI-Aufruf), SEO nur für die Startseite", async () => {
    const calls: string[] = [];
    const runAi: RunAi = async (args) => {
      calls.push(args.step);
      return { output: args.schema.parse({ pages: [{ slug: "/", title: "Titel", meta_description: "Beschreibung" }] }) as never, costEur: 0.001 };
    };
    const base: RunState = { options: { ...DEFAULT_OPTIONS, package: "STARTER" }, features: [], plan, home };
    const skipped = await executeAiStep("copy_leistungen", { lead, profile, state: base, runAi });
    expect(skipped.costEur).toBe(0);
    expect(calls).toEqual([]);

    let seoText = "";
    await executeAiStep("seo", { lead, profile, state: base, runAi: async (a) => { seoText = a.userText; return runAi(a); } });
    expect(seoText).toMatch(/<seiten>\n\/\n<\/seiten>/);
    expect(calls).toEqual(["demo_seo"]);
  });

  it("Profi und Premium fragen SEO für drei Seiten an", async () => {
    let seoText = "";
    await executeAiStep("seo", {
      lead,
      profile,
      state: state("BUSINESS_PLUS"),
      runAi: async (a) => {
        seoText = a.userText;
        return { output: seo as never, costEur: 0 };
      },
    });
    expect(seoText).toMatch(/<seiten>\n\/\n\/leistungen\n\/kontakt\n<\/seiten>/);
  });

  it("Pläne mit Kontaktdaten gehen nie an die KI", async () => {
    let text = "";
    await executeAiStep("plan", { lead, profile, state: { options: { package: "BUSINESS_PLUS", style: "premium", scheme: "dark" } }, runAi: async (a) => { text = a.userText; return { output: plan as never, costEur: 0 }; } });
    expect(text).toContain('festgelegt auf "premium"');
    expect(text).not.toContain(lead.phone!);
    expect(text).not.toContain(lead.email!);
  });

  it("Basis ohne Leistungs-Text lässt sich zusammenbauen, Profi ohne bricht ab", () => {
    expect(() => assemble(lead, profile, { ...state("STARTER"), leistungen: undefined })).not.toThrow();
    expect(() => assemble(lead, profile, { ...state("BUSINESS"), leistungen: undefined })).toThrow(/Texte fehlen/);
  });
});
