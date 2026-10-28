import { z } from "zod";

// Wählbare Bausteine der Demo (Etappe 4C). Reihenfolge = Reihenfolge in der Oberfläche.
export const FEATURES = ["map", "hours_area", "gallery", "pricing_team", "booking_request"] as const;
export type Feature = (typeof FEATURES)[number];

export const FEATURE_LABELS: Record<Feature, string> = {
  map: "Karte und Anfahrt",
  hours_area: "Öffnungszeiten und Einsatzgebiet",
  gallery: "Galerie / Referenzen",
  pricing_team: "Preise / Pakete und Team",
  booking_request: "Terminanfrage",
};

export const FEATURE_HINTS: Record<Feature, string> = {
  map: "Die Karte lädt erst nach Einwilligung des Besuchers.",
  hours_area: "Nur belegte Angaben, sonst markierter Platzhalter.",
  gallery: "Bildraster mit Platzhaltern, echte Fotos liefert der Kunde.",
  pricing_team: "Preise bleiben immer Platzhalter, Team mit Ansprechpartner aus den Stammdaten.",
  booking_request: "Formular mit Wunschtermin; Versand ab Milestone 6, keine echte Buchung.",
};

export const DEFAULT_FEATURES: Feature[] = ["map"];

export const featuresSchema = z.array(z.enum(FEATURES)).max(FEATURES.length);

/** Ungültige Werte entfallen, Doppelte auch; die Reihenfolge ist immer die der Oberfläche. */
export function normalizeFeatures(input: unknown): Feature[] {
  const wanted = new Set(Array.isArray(input) ? input.filter((v): v is string => typeof v === "string") : []);
  return FEATURES.filter((f) => wanted.has(f));
}

/** Nur diese Features brauchen einen KI-Aufruf für Texte; die Karte nicht. */
export function needsFeatureCopy(features: Feature[]): boolean {
  return features.some((f) => f !== "map");
}
