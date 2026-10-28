import { randomInt } from "node:crypto";

const REPLACEMENTS: [RegExp, string][] = [
  [/ä/g, "ae"],
  [/ö/g, "oe"],
  [/ü/g, "ue"],
  [/ß/g, "ss"],
];
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export const PREVIEW_SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

export function slugify(name: string): string {
  let s = name.toLowerCase();
  for (const [from, to] of REPLACEMENTS) s = s.replace(from, to);
  s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return s.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/**
 * Vorschau-Adresse mit zufälligem Anhang. Solange es keinen Passwortschutz gibt (Milestone 5), ist die Demo
 * nur über den Link erreichbar — der Anhang macht ihn nicht erratbar. Der Zufall kommt aus node:crypto.
 */
export function previewSlug(companyName: string, suffixLength = 6): string {
  const base = slugify(companyName).slice(0, 40).replace(/-+$/g, "") || "demo";
  const suffix = Array.from({ length: suffixLength }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${base}-${suffix}`;
}
