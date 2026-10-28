import type { ScoringConfig } from "./config";

export interface ScoreLeadInput {
  website_url: string | null;
  phone: string | null;
  email: string | null;
  google_rating: number | null;
  google_rating_count: number | null;
  industry: string;
  address_zip: string | null;
}

export interface ScoreAuditInput {
  has_ssl: boolean | null;
  pagespeed_mobile_score: number | null;
  pagespeed_performance_score: number | null;
  meta_title_ok: boolean | null;
  meta_description_ok: boolean | null;
  heading_structure_ok: boolean | null;
  phone_detected: boolean | null;
  contact_form_detected: boolean | null;
  design_quality_score: number | null;
  social_link_count: number | null;
}

export interface FactorResult {
  key: string;
  label: string;
  /** Normalisiertes Gewicht (Summe aller Faktoren = 1) */
  weight: number;
  /** Teilwert 0–100 */
  value: number;
  /** Beitrag zum Gesamtscore in Punkten */
  contribution: number;
  measured: boolean;
  note?: string;
}

export interface ModifierResult {
  key: string;
  label: string;
  applied: boolean;
  points: number;
}

export interface ScoreResult {
  website: { score: number; applicable: boolean; factors: FactorResult[] };
  business: { score: number; factors: FactorResult[] };
  opportunity: {
    score: number;
    /** Wert vor der Begrenzung auf 0–100 */
    raw: number;
    base: FactorResult[];
    modifiers: ModifierResult[];
  };
  reachable: boolean;
  noWebsiteBonusApplied: boolean;
  noContactMalusApplied: boolean;
}

const HANDWERK = new Set(["maler", "elektro", "shk", "dachdecker", "garten_landschaft"]);

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value);

interface RawFactor {
  key: string;
  label: string;
  weightKey: string;
  value: number | null;
  note?: string;
}

// Gewichte werden normalisiert, damit ein falsch konfigurierter Satz (Summe ≠ 1) nie Scores über 100 erzeugt.
function weigh(raw: RawFactor[], config: ScoringConfig): { score: number; factors: FactorResult[] } {
  const weights = raw.map((f) => Math.max(0, config.numbers[f.weightKey] ?? 0));
  const total = weights.reduce((sum, w) => sum + w, 0);

  const factors = raw.map((f, i): FactorResult => {
    const measured = f.value !== null;
    const value = clamp(f.value ?? 0);
    const weight = total > 0 ? weights[i] / total : 0;
    return {
      key: f.key,
      label: f.label,
      weight,
      value,
      contribution: value * weight,
      measured,
      note: measured ? f.note : (f.note ?? "nicht gemessen"),
    };
  });

  return { score: round(factors.reduce((sum, f) => sum + f.contribution, 0)), factors };
}

function seoValue(audit: ScoreAuditInput): number | null {
  const checks = [audit.meta_title_ok, audit.meta_description_ok, audit.heading_structure_ok];
  if (checks.every((c) => c === null)) return null;
  const passed = checks.filter((c) => c === true).length;
  return (passed / checks.length) * 100;
}

function contactValue(audit: ScoreAuditInput): number | null {
  if (audit.phone_detected === null && audit.contact_form_detected === null) return null;
  return (audit.phone_detected ? 50 : 0) + (audit.contact_form_detected ? 50 : 0);
}

function websiteScore(
  lead: ScoreLeadInput,
  audit: ScoreAuditInput | null,
  config: ScoringConfig,
): ScoreResult["website"] {
  if (!lead.website_url) {
    return { score: 0, applicable: false, factors: [] };
  }
  const a = audit;
  const raw: RawFactor[] = [
    { key: "mobile", label: "Mobile-Optimierung", weightKey: "website.weight.mobile", value: a?.pagespeed_mobile_score ?? null },
    { key: "performance", label: "Ladezeit/Performance", weightKey: "website.weight.performance", value: a?.pagespeed_performance_score ?? null },
    { key: "seo", label: "SEO-Basis", weightKey: "website.weight.seo", value: a ? seoValue(a) : null },
    { key: "design", label: "Designqualität", weightKey: "website.weight.design", value: a?.design_quality_score ?? null, note: "KI-Einschätzung" },
    { key: "contact", label: "Kontakt/CTA", weightKey: "website.weight.contact", value: a ? contactValue(a) : null },
    { key: "ssl", label: "SSL", weightKey: "website.weight.ssl", value: a?.has_ssl == null ? null : a.has_ssl ? 100 : 0 },
  ];
  return { ...weigh(raw, config), applicable: true };
}

function businessScore(
  lead: ScoreLeadInput,
  audit: ScoreAuditInput | null,
  config: ScoringConfig,
): ScoreResult["business"] {
  const floor = config.numbers["business.rating_floor"] ?? 3;
  const cap = config.numbers["business.review_cap"] ?? 150;
  const otherFit = config.numbers["business.industry_fit_other"] ?? 40;
  const prefixes = (config.texts["region.home_zip_prefixes"] ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  const rating =
    lead.google_rating === null ? null : ((lead.google_rating - floor) / (5 - floor)) * 100;
  const reviews =
    lead.google_rating_count === null ? null : Math.min(lead.google_rating_count / cap, 1) * 100;

  let digital: number | null;
  let digitalNote: string | undefined;
  if (!lead.website_url) {
    digital = 0;
    digitalNote = "keine Website";
  } else if (audit?.social_link_count == null) {
    digital = null;
  } else {
    digital = 30 + Math.min(audit.social_link_count, 2) * 35;
    digitalNote = `${audit.social_link_count} Social-Link${audit.social_link_count === 1 ? "" : "s"} gefunden`;
  }

  let regional: number | null = null;
  let regionalNote: string | undefined;
  if (lead.address_zip) {
    const match = prefixes.some((p) => lead.address_zip!.startsWith(p));
    regional = match ? 100 : 30;
    regionalNote = match ? "in der Heimatregion" : "außerhalb der Heimatregion";
  }

  const raw: RawFactor[] = [
    { key: "rating", label: "Google-Sterne", weightKey: "business.weight.rating", value: rating, note: lead.google_rating !== null ? `${lead.google_rating} Sterne` : undefined },
    { key: "reviews", label: "Anzahl Bewertungen", weightKey: "business.weight.reviews", value: reviews, note: lead.google_rating_count !== null ? `${lead.google_rating_count} Bewertungen` : undefined },
    { key: "industry", label: "Branchen-Fit", weightKey: "business.weight.industry", value: HANDWERK.has(lead.industry) ? 100 : otherFit },
    { key: "digital", label: "Digitalaffinität", weightKey: "business.weight.digital", value: digital, note: digitalNote },
    { key: "regional", label: "Regionale Nähe", weightKey: "business.weight.regional", value: regional, note: regionalNote },
  ];
  return weigh(raw, config);
}

export function computeScores(
  lead: ScoreLeadInput,
  audit: ScoreAuditInput | null,
  config: ScoringConfig,
): ScoreResult {
  const website = websiteScore(lead, audit, config);
  const business = businessScore(lead, audit, config);

  const reachable = Boolean(lead.phone?.trim() || lead.email?.trim());
  const noWebsite = !lead.website_url;

  const wBusiness = config.numbers["opportunity.weight_business"] ?? 0.5;
  const wGap = config.numbers["opportunity.weight_website_gap"] ?? 0.5;
  const weightTotal = wBusiness + wGap || 1;

  const base: FactorResult[] = [
    {
      key: "business",
      label: "Business-Potential",
      weight: wBusiness / weightTotal,
      value: business.score,
      contribution: (business.score * wBusiness) / weightTotal,
      measured: true,
    },
    {
      key: "website_gap",
      label: "Website-Lücke (100 − Website-Score)",
      weight: wGap / weightTotal,
      value: 100 - website.score,
      contribution: ((100 - website.score) * wGap) / weightTotal,
      measured: true,
    },
  ];

  const bonus = config.numbers["opportunity.no_website_bonus"] ?? 10;
  const malus = config.numbers["opportunity.no_contact_malus"] ?? 30;
  const modifiers: ModifierResult[] = [
    { key: "no_website_bonus", label: "Bonus: keine Website vorhanden", applied: noWebsite, points: noWebsite ? bonus : 0 },
    { key: "no_contact_malus", label: "Malus: weder Telefon noch E-Mail", applied: !reachable, points: !reachable ? -malus : 0 },
  ];

  const raw = base.reduce((sum, f) => sum + f.contribution, 0) + modifiers.reduce((sum, m) => sum + m.points, 0);

  return {
    website,
    business,
    opportunity: { score: round(clamp(raw)), raw, base, modifiers },
    reachable,
    noWebsiteBonusApplied: noWebsite,
    noContactMalusApplied: !reachable,
  };
}

export type OpportunityBand = "high" | "standard" | "low";

export function opportunityBand(score: number, config: ScoringConfig): OpportunityBand {
  if (score >= (config.numbers["threshold.high"] ?? 80)) return "high";
  if (score >= (config.numbers["threshold.standard"] ?? 50)) return "standard";
  return "low";
}
