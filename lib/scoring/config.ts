export interface ScoringConfig {
  numbers: Record<string, number>;
  texts: Record<string, string>;
}

export interface ConfigRowDefinition {
  key: string;
  value: number;
  textValue?: string;
  description: string;
}

// Standardwerte laut docs/12-milestone-3-lead-intelligence.md. Fehlt ein Schlüssel in der
// Datenbank, gilt dieser Wert — die Berechnung bricht nie wegen unvollständiger Konfiguration ab.
export const DEFAULT_CONFIG_ROWS: ConfigRowDefinition[] = [
  { key: "website.weight.mobile", value: 0.25, description: "Website-Score: Mobile-Optimierung" },
  { key: "website.weight.performance", value: 0.2, description: "Website-Score: Ladezeit/Performance" },
  { key: "website.weight.seo", value: 0.2, description: "Website-Score: SEO-Basis (Title, Description, Überschriften)" },
  { key: "website.weight.design", value: 0.2, description: "Website-Score: Designqualität (KI-Einschätzung)" },
  { key: "website.weight.contact", value: 0.1, description: "Website-Score: Kontaktmöglichkeiten/CTA" },
  { key: "website.weight.ssl", value: 0.05, description: "Website-Score: SSL" },
  { key: "business.weight.rating", value: 0.3, description: "Business-Potential: Google-Sterne" },
  { key: "business.weight.reviews", value: 0.25, description: "Business-Potential: Anzahl Bewertungen" },
  { key: "business.weight.industry", value: 0.2, description: "Business-Potential: Branchen-Fit" },
  { key: "business.weight.digital", value: 0.15, description: "Business-Potential: Digitalaffinität" },
  { key: "business.weight.regional", value: 0.1, description: "Business-Potential: Regionale Nähe" },
  { key: "business.rating_floor", value: 3, description: "Sterne, ab denen der Bewertungs-Teilwert 0 beträgt" },
  { key: "business.review_cap", value: 150, description: "Bewertungsanzahl mit voller Punktzahl" },
  { key: "business.industry_fit_other", value: 40, description: "Branchen-Fit außerhalb des Handwerks (0–100)" },
  { key: "opportunity.weight_business", value: 0.5, description: "Opportunity: Anteil Business-Potential" },
  { key: "opportunity.weight_website_gap", value: 0.5, description: "Opportunity: Anteil Website-Lücke (100 − Website-Score)" },
  { key: "opportunity.no_website_bonus", value: 10, description: "Opportunity: Bonus, wenn keine Website existiert" },
  { key: "opportunity.no_contact_malus", value: 30, description: "Opportunity: Malus ohne Telefon und E-Mail" },
  { key: "threshold.high", value: 80, description: "Ab diesem Opportunity-Score: Hohes Potenzial" },
  { key: "threshold.standard", value: 50, description: "Ab diesem Opportunity-Score: Standard, darunter niedrig" },
  {
    key: "region.home_zip_prefixes",
    value: 0,
    textValue: "77,78,79",
    description: "Heimatregion: kommagetrennte PLZ-Präfixe",
  },
];

export function buildConfig(
  rows: { config_key: string; value: number | string; text_value: string | null }[] = [],
): ScoringConfig {
  const numbers: Record<string, number> = {};
  const texts: Record<string, string> = {};
  for (const def of DEFAULT_CONFIG_ROWS) {
    numbers[def.key] = def.value;
    if (def.textValue !== undefined) texts[def.key] = def.textValue;
  }
  for (const row of rows) {
    const value = Number(row.value);
    if (Number.isFinite(value)) numbers[row.config_key] = value;
    if (row.text_value !== null) texts[row.config_key] = row.text_value;
  }
  return { numbers, texts };
}
