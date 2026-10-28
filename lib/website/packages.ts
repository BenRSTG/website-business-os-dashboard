import { FEATURES, type Feature } from "./features";

// Pakete der Demo. In der Datenbank heißen sie STARTER / BUSINESS / BUSINESS_PLUS (site_package), in der Oberfläche Basis / Profi / Premium.
export const PACKAGES = ["STARTER", "BUSINESS", "BUSINESS_PLUS"] as const;
export type SitePackage = (typeof PACKAGES)[number];

export const DEFAULT_PACKAGE: SitePackage = "BUSINESS";

export const PACKAGE_LABELS: Record<SitePackage, string> = {
  STARTER: "Basis",
  BUSINESS: "Profi",
  BUSINESS_PLUS: "Premium",
};

export const PACKAGE_HINTS: Record<SitePackage, string> = {
  STARTER: "Eine Seite mit Leistungen und Kontakt, dazu Impressum und Datenschutz.",
  BUSINESS: "Fünf Seiten mit allen Bausteinen.",
  BUSINESS_PLUS: "Wie Profi, dazu Animationen und großzügigerer Look.",
};

export function isPackage(value: unknown): value is SitePackage {
  return typeof value === "string" && (PACKAGES as readonly string[]).includes(value);
}

export function normalizePackage(value: unknown): SitePackage {
  return isPackage(value) ? value : DEFAULT_PACKAGE;
}

const STARTER_FEATURES: Feature[] = ["map", "hours_area"];

/** Bausteine, die das Paket enthält. Alles andere wird serverseitig entfernt, auch wenn die Oberfläche es anbietet. */
export function allowedFeatures(pkg: SitePackage): readonly Feature[] {
  return pkg === "STARTER" ? STARTER_FEATURES : FEATURES;
}

export function restrictFeatures(features: Feature[], pkg: SitePackage): Feature[] {
  const allowed = allowedFeatures(pkg);
  return features.filter((f) => allowed.includes(f));
}

/** Basis ist eine Seite mit Sprungmarken, die anderen Pakete haben getrennte Seiten. */
export const isOnePager = (pkg: SitePackage) => pkg === "STARTER";
/** Bewegung und großzügigere Abstände gibt es nur im Premium-Paket. */
export const hasMotion = (pkg: SitePackage) => pkg === "BUSINESS_PLUS";

export function requiredSlugs(pkg: SitePackage): string[] {
  return isOnePager(pkg)
    ? ["/", "/impressum", "/datenschutz"]
    : ["/", "/leistungen", "/kontakt", "/impressum", "/datenschutz"];
}
