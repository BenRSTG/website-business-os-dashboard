import "server-only";

const DEFAULT_ENGINE_URL = "https://website-business-os-site-engine.vercel.app";

/**
 * Sagt dem site-engine, dass sich Websites geändert haben (Vorschau-Adressen oder Domains). Ein Fehlschlag ist nicht
 * schlimm — der Cache läuft nach wenigen Minuten ohnehin ab —, wird aber gemeldet, damit niemand eine Sperre für sofort hält.
 */
export async function revalidateSites(keys: string[]): Promise<boolean> {
  const secret = process.env.REVALIDATE_SECRET;
  const unique = [...new Set(keys.filter(Boolean))];
  if (unique.length === 0) return true;
  if (!secret) {
    console.error("REVALIDATE_SECRET ist nicht gesetzt: Änderungen werden im site-engine verzögert sichtbar.");
    return false;
  }
  const base = (process.env.SITE_ENGINE_URL || DEFAULT_ENGINE_URL).replace(/\/+$/, "");
  try {
    const response = await fetch(`${base}/api/revalidate`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-revalidate-secret": secret },
      body: JSON.stringify({ keys: unique }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) console.error(`Aktualisierung am site-engine fehlgeschlagen (${response.status}).`);
    return response.ok;
  } catch (error) {
    console.error("Aktualisierung am site-engine nicht erreichbar:", error);
    return false;
  }
}
