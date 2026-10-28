import type { Fact } from "@/lib/intelligence/company-profile";
import type { Lead } from "@/lib/leads/types";
import { parseSections } from "./content/schemas";
import type { PageDraft } from "./compose";
import { requiredSlugs, type SitePackage } from "./packages";
import { contrastIssues, designTokensSchema, type DesignTokens } from "./tokens";

export interface QualityReport {
  /** Blockieren das Ablegen der Demo */
  errors: string[];
  /** Hinweise, die geprüft werden sollten, aber nichts blockieren */
  warnings: string[];
  /** Offene Platzhalter, die der Betrieb liefern oder bestätigen muss */
  placeholders: string[];
}


// Aussagen, die ohne Beleg nie auf der Website stehen dürfen (docs/10 §B2).
const CLAIM_KEYWORDS = [
  "meisterbetrieb",
  "meisterbrief",
  "zertifiziert",
  "ausgezeichnet",
  "preisgekrönt",
  "innung",
  "notdienst",
  "24 stunden",
  "24-stunden",
  "rund um die uhr",
  "garantie",
  "festpreis",
  "kostenlos",
  "kostenfrei",
  "jahrelange erfahrung",
  "langjährige erfahrung",
  "familienbetrieb",
  "seit über",
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ");
}

/** Alle Zahlen und Schlüsselbegriffe im KI-Text, die weder in den Stammdaten noch in einem verifizierten Fakt vorkommen. */
export function findUnbackedClaims(aiText: string, lead: Lead, facts: Fact[]): string[] {
  const allowed = normalize(
    [
      lead.company_name,
      lead.address_city ?? "",
      lead.address_zip ?? "",
      lead.google_rating !== null ? String(lead.google_rating).replace(".", ",") : "",
      lead.google_rating_count !== null ? String(lead.google_rating_count) : "",
      ...facts.filter((f) => f.status === "verified").map((f) => f.claim),
    ].join(" "),
  );
  const text = normalize(aiText);
  const found: string[] = [];

  for (const number of new Set(text.match(/\d+(?:[.,]\d+)?/g) ?? [])) {
    if (!allowed.includes(number)) found.push(`Zahl „${number}“ ist nicht belegt`);
  }
  for (const keyword of CLAIM_KEYWORDS) {
    if (text.includes(keyword) && !allowed.includes(keyword)) found.push(`„${keyword}“ ist nicht belegt`);
  }
  return found;
}

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => collectStrings(v, out));
  return out;
}

export function checkQuality(input: {
  package: SitePackage;
  lead: Lead;
  facts: Fact[];
  tokens: DesignTokens;
  pages: PageDraft[];
  /** Nur die von der KI geschriebenen Texte (die Stammdaten setzt das System selbst) */
  aiCopy: unknown;
}): QualityReport {
  const { lead, facts, tokens, pages, aiCopy } = input;
  const errors: string[] = [];
  const warnings: string[] = [];
  const placeholders: string[] = [];

  for (const slug of requiredSlugs(input.package)) {
    if (!pages.some((p) => p.slug === slug)) errors.push(`Pflichtseite ${slug} fehlt`);
  }

  for (const page of pages) {
    const results = parseSections(page.sections);
    results.forEach((r, i) => {
      if (!r.ok) errors.push(`Seite ${page.slug}, Abschnitt ${i + 1}: ${r.error}`);
    });
    const types = results.flatMap((r) => (r.ok ? [r.section.component_type] : []));
    if (types[0] !== "navbar") errors.push(`Seite ${page.slug}: Navigation fehlt am Anfang`);
    if (types.at(-1) !== "footer") errors.push(`Seite ${page.slug}: Footer fehlt am Ende`);
  }

  if (!designTokensSchema.safeParse(tokens).success) errors.push("Design-Werte sind ungültig");
  errors.push(...contrastIssues(tokens));

  // Kontaktdaten stammen aus den Stammdaten; hier wird gegengeprüft, dass sie unverändert im Footer stehen.
  const footer = pages
    .flatMap((p) => parseSections(p.sections))
    .flatMap((r) => (r.ok && r.section.component_type === "footer" ? [r.section] : []))[0];
  if (footer && footer.component_type === "footer") {
    if ((footer.content.phone ?? null) !== lead.phone) errors.push("Telefonnummer im Footer weicht von den Stammdaten ab");
    if ((footer.content.email ?? null) !== lead.email) errors.push("E-Mail im Footer weicht von den Stammdaten ab");
  }
  if (!lead.phone && !lead.email) warnings.push("Weder Telefon noch E-Mail vorhanden: Besucher können den Betrieb nicht erreichen.");
  else if (!lead.phone) warnings.push("Keine Telefonnummer vorhanden: Die Anrufleiste entfällt, der Knopf führt zum Kontaktbereich.");

  const copyText = collectStrings(aiCopy);
  for (const claim of findUnbackedClaims(copyText.join(" \n "), lead, facts)) {
    warnings.push(`Im Text: ${claim}. Bitte vor Zeigen prüfen oder streichen.`);
  }
  // Markierte Platzhalter in den Seiten (Preise, Zeiten, Namen …): jeder einzelne wird gelistet, damit nichts ungeprüft live geht.
  const seen = new Set<string>();
  for (const page of pages.filter((p) => p.page_type !== "impressum" && p.page_type !== "datenschutz")) {
    for (const text of collectStrings(page.sections)) {
      for (const match of text.match(/\[[^\]]+\]/g) ?? []) {
        const line = `${page.title}: ${match}`;
        if (!seen.has(line)) {
          seen.add(line);
          placeholders.push(line);
        }
      }
    }
  }

  for (const page of pages.filter((p) => p.page_type === "impressum" || p.page_type === "datenschutz")) {
    for (const r of parseSections(page.sections)) {
      if (!r.ok || r.section.component_type !== "legal") continue;
      for (const f of r.section.content.fields) if (!f.value) placeholders.push(`${r.section.content.title}: „${f.label}“ fehlt`);
      for (const s of r.section.content.sections ?? []) placeholders.push(`${r.section.content.title}: Abschnitt „${s.heading}“ ist noch Vorlage`);
    }
  }
  const openFacts = facts.filter((f) => f.status !== "verified").length;
  if (openFacts > 0) warnings.push(`${openFacts} Aussagen im Unternehmensprofil sind nicht belegt und wurden nicht als Tatsachen verwendet.`);
  warnings.push("Alle Bilder sind Platzhalter.");

  return { errors, warnings, placeholders };
}
