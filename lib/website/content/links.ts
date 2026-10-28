// KOPIE aus site-engine/lib/content/links.ts — bei Änderungen beide Dateien angleichen (Abgleich über tests/website/schema-drift.test.ts).
/**
 * Erlaubte Link-Ziele in Seiteninhalten: Anker (#kontakt), interne Pfade (/leistungen), https-Adressen,
 * mailto: und tel:. Alles andere — vor allem javascript: und data: — wird abgelehnt.
 */
export function isSafeHref(value: string): boolean {
  const v = value.trim();
  if (v.length === 0 || v.length > 500) return false;
  if (/[\u0000-\u001f\u007f\s\\]/.test(v)) return false;
  if (v.startsWith("#")) return /^#[A-Za-z0-9_-]*$/.test(v);
  if (v.startsWith("/")) return !v.startsWith("//");
  try {
    const url = new URL(v);
    if (url.protocol === "https:") return url.hostname.length > 0;
    if (url.protocol === "mailto:") return /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+/.test(v);
    if (url.protocol === "tel:") return /^tel:\+?[0-9][0-9\-().]{4,24}$/.test(v);
    return false;
  } catch {
    return false;
  }
}

/** Aus einer Telefonnummer wie "07821 555 0101" einen tel:-Link bauen. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
