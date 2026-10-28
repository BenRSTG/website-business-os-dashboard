import { describe, expect, it } from "vitest";
import { buildConfig } from "@/lib/scoring/config";
import {
  computeScores,
  opportunityBand,
  type ScoreAuditInput,
  type ScoreLeadInput,
} from "@/lib/scoring/compute";

const config = buildConfig();

const lead = (overrides: Partial<ScoreLeadInput> = {}): ScoreLeadInput => ({
  website_url: "https://example.com",
  phone: "07821 555 0101",
  email: null,
  google_rating: 4.6,
  google_rating_count: 90,
  industry: "elektro",
  address_zip: "77933",
  ...overrides,
});

const audit = (overrides: Partial<ScoreAuditInput> = {}): ScoreAuditInput => ({
  has_ssl: true,
  pagespeed_mobile_score: 80,
  pagespeed_performance_score: 50,
  meta_title_ok: true,
  meta_description_ok: false,
  heading_structure_ok: true,
  phone_detected: true,
  contact_form_detected: false,
  design_quality_score: 40,
  social_link_count: 1,
  ...overrides,
});

describe("Website-Score", () => {
  it("ist 0 und nicht anwendbar, wenn keine Website existiert", () => {
    const result = computeScores(lead({ website_url: null }), null, config);
    expect(result.website.score).toBe(0);
    expect(result.website.applicable).toBe(false);
    expect(result.website.factors).toHaveLength(0);
  });

  it("gewichtet die sechs Faktoren wie festgelegt", () => {
    // 0,25·80 + 0,2·50 + 0,2·66,67 + 0,2·40 + 0,1·50 + 0,05·100 = 61,33
    const result = computeScores(lead(), audit(), config);
    expect(result.website.score).toBe(61);
    const byKey = Object.fromEntries(result.website.factors.map((f) => [f.key, f]));
    expect(byKey.seo.value).toBeCloseTo(66.667, 2);
    expect(byKey.contact.value).toBe(50);
    expect(byKey.ssl.value).toBe(100);
    expect(byKey.mobile.contribution).toBeCloseTo(20, 5);
  });

  it("normalisiert Gewichte, die nicht 1 ergeben", () => {
    const flat = buildConfig(
      ["mobile", "performance", "seo", "design", "contact", "ssl"].map((k) => ({
        config_key: `website.weight.${k}`,
        value: 1,
        text_value: null,
      })),
    );
    // Mittelwert aus 80, 50, 66,67, 40, 50, 100 = 64,44
    expect(computeScores(lead(), audit(), flat).website.score).toBe(64);
  });

  it("markiert fehlende Messungen als nicht gemessen und wertet sie mit 0", () => {
    const result = computeScores(lead(), null, config);
    expect(result.website.score).toBe(0);
    expect(result.website.factors.every((f) => !f.measured)).toBe(true);
    expect(result.website.factors[0].note).toBe("nicht gemessen");
  });

  it("wertet SSL ohne HTTPS mit 0", () => {
    const result = computeScores(lead(), audit({ has_ssl: false }), config);
    expect(result.website.factors.find((f) => f.key === "ssl")?.value).toBe(0);
  });
});

describe("Business-Potential-Score", () => {
  it("rechnet Sterne, Bewertungen, Branche, Digitalaffinität und Region", () => {
    // Keine Website: Digital = 0. Sterne 4,6 → 80, 90 Bewertungen → 60, Handwerk 100, PLZ 77 → 100.
    // 0,3·80 + 0,25·60 + 0,2·100 + 0,15·0 + 0,1·100 = 69
    const result = computeScores(lead({ website_url: null }), null, config);
    expect(result.business.score).toBe(69);
  });

  it("deckelt die Bewertungsanzahl bei 150", () => {
    const result = computeScores(lead({ google_rating_count: 900 }), audit(), config);
    expect(result.business.factors.find((f) => f.key === "reviews")?.value).toBe(100);
  });

  it("wertet Sterne unter 3,0 mit 0", () => {
    const result = computeScores(lead({ google_rating: 2.4 }), audit(), config);
    expect(result.business.factors.find((f) => f.key === "rating")?.value).toBe(0);
  });

  it("bewertet Branchen außerhalb des Handwerks niedriger", () => {
    const result = computeScores(lead({ industry: "sonstiges" }), audit(), config);
    expect(result.business.factors.find((f) => f.key === "industry")?.value).toBe(40);
  });

  it("berechnet Digitalaffinität aus Website und Social-Links (max. 2 zählen)", () => {
    const one = computeScores(lead(), audit({ social_link_count: 1 }), config);
    const many = computeScores(lead(), audit({ social_link_count: 7 }), config);
    expect(one.business.factors.find((f) => f.key === "digital")?.value).toBe(65);
    expect(many.business.factors.find((f) => f.key === "digital")?.value).toBe(100);
  });

  it("wertet die Region nach PLZ-Präfix; unbekannte PLZ ist nicht gemessen", () => {
    const home = computeScores(lead({ address_zip: "79098" }), audit(), config);
    const away = computeScores(lead({ address_zip: "10115" }), audit(), config);
    const unknown = computeScores(lead({ address_zip: null }), audit(), config);
    const regional = (r: typeof home) => r.business.factors.find((f) => f.key === "regional")!;
    expect(regional(home).value).toBe(100);
    expect(regional(away).value).toBe(30);
    expect(regional(unknown).measured).toBe(false);
  });

  it("liest die Heimatregion aus der Konfiguration", () => {
    const custom = buildConfig([{ config_key: "region.home_zip_prefixes", value: 0, text_value: "10, 12" }]);
    const result = computeScores(lead({ address_zip: "10115" }), audit(), custom);
    expect(result.business.factors.find((f) => f.key === "regional")?.value).toBe(100);
  });
});

describe("Sales-Opportunity-Score", () => {
  it("mischt Business-Potential und Website-Lücke je zur Hälfte und gibt Leads ohne Website +10", () => {
    // Business 69, Website 0 → 0,5·69 + 0,5·100 + 10 = 94,5
    const result = computeScores(lead({ website_url: null }), null, config);
    expect(result.opportunity.raw).toBeCloseTo(94.5, 5);
    expect(result.opportunity.score).toBe(Math.round(result.opportunity.raw));
    expect(result.noWebsiteBonusApplied).toBe(true);
    expect(result.opportunity.modifiers.find((m) => m.key === "no_website_bonus")?.points).toBe(10);
  });

  it("begrenzt den Score auf 100", () => {
    const strong = lead({ website_url: null, google_rating: 5, google_rating_count: 400 });
    const result = computeScores(strong, null, config);
    expect(result.opportunity.raw).toBeGreaterThan(100);
    expect(result.opportunity.score).toBe(100);
  });

  it("zieht 30 Punkte ab, wenn weder Telefon noch E-Mail vorhanden sind, und kennzeichnet den Lead", () => {
    const withContact = computeScores(lead(), audit(), config);
    const noContact = computeScores(lead({ phone: null, email: null }), audit(), config);
    expect(noContact.reachable).toBe(false);
    expect(noContact.noContactMalusApplied).toBe(true);
    expect(noContact.opportunity.raw).toBeCloseTo(withContact.opportunity.raw - 30, 5);
  });

  it("behandelt leere Kontaktfelder wie fehlende", () => {
    expect(computeScores(lead({ phone: "  ", email: "" }), audit(), config).reachable).toBe(false);
    expect(computeScores(lead({ phone: null, email: "a@b.de" }), audit(), config).reachable).toBe(true);
  });

  it("wird nie negativ", () => {
    const weak = lead({ phone: null, email: null, google_rating: null, google_rating_count: null, industry: "sonstiges" });
    const result = computeScores(weak, audit({ pagespeed_mobile_score: 100, pagespeed_performance_score: 100, design_quality_score: 100, meta_title_ok: true, meta_description_ok: true, contact_form_detected: true }), config);
    expect(result.opportunity.score).toBeGreaterThanOrEqual(0);
  });

  it("nutzt konfigurierte Modifikatoren", () => {
    const custom = buildConfig([
      { config_key: "opportunity.no_contact_malus", value: 10, text_value: null },
    ]);
    const base = computeScores(lead(), audit(), custom);
    const noContact = computeScores(lead({ phone: null }), audit(), custom);
    expect(noContact.opportunity.raw).toBeCloseTo(base.opportunity.raw - 10, 5);
  });
});

describe("Schwellen", () => {
  it.each([
    [100, "high"],
    [80, "high"],
    [79, "standard"],
    [50, "standard"],
    [49, "low"],
    [0, "low"],
  ])("Score %i ist %s", (score, band) => {
    expect(opportunityBand(score, config)).toBe(band);
  });
});

describe("Konfiguration", () => {
  it("ergänzt fehlende Schlüssel mit Standardwerten und ignoriert ungültige Zahlen", () => {
    const cfg = buildConfig([
      { config_key: "threshold.high", value: 90, text_value: null },
      { config_key: "threshold.standard", value: "kaputt", text_value: null },
    ]);
    expect(cfg.numbers["threshold.high"]).toBe(90);
    expect(cfg.numbers["threshold.standard"]).toBe(50);
    expect(cfg.numbers["website.weight.mobile"]).toBe(0.25);
  });
});
