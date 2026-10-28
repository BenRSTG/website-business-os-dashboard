import type { HtmlChecks } from "@/lib/audit/html-parse";
import type { PageSpeedResult } from "@/lib/audit/pagespeed";
import type { Finding } from "./types";

/** Regelbasierte Befunde aus den technischen Messungen — Pitch-Material ohne KI. */
export function technicalFindings(checks: HtmlChecks | null, pageSpeed: PageSpeedResult | null): Finding[] {
  const out: string[] = [];

  if (checks) {
    if (!checks.hasSsl) out.push("Kein SSL-Zertifikat: Browser zeigen eine Sicherheitswarnung an.");
    if (!checks.viewportPresent) out.push("Kein Viewport-Hinweis im Quelltext: Die Seite ist vermutlich nicht für Mobilgeräte angepasst.");
    if (!checks.phoneDetected) out.push("Keine Telefonnummer erkennbar.");
    else if (!checks.phoneLinkPresent) out.push("Die Telefonnummer steht nur im Text, es gibt keinen klickbaren Anruf-Link. Mobil ist so kein Anruf per Fingertipp möglich.");
    if (!checks.contactFormDetected) out.push("Kein Kontaktformular gefunden.");
    if (!checks.mapsEmbedDetected) out.push("Keine Karte oder Anfahrtsbeschreibung eingebunden.");
    if (!checks.title) out.push("Die Seite hat keinen Title, das schadet der Auffindbarkeit bei Google.");
    else if (!checks.metaTitleOk) out.push(`Der Title ist unpassend lang (${checks.title.length} Zeichen, sinnvoll sind 10 bis 70).`);
    if (!checks.metaDescription) out.push("Keine Meta-Description hinterlegt.");
    else if (!checks.metaDescriptionOk) out.push(`Die Meta-Description ist unpassend lang (${checks.metaDescription.length} Zeichen, sinnvoll sind 50 bis 170).`);
    if (!checks.headingStructureOk) out.push("Die Überschriftenstruktur ist unsauber: erwartet wird genau eine H1 und eine lückenlose Hierarchie.");
    if (!checks.navigationDetected) out.push("Keine erkennbare Navigation.");
    if (checks.socialLinkCount === 0) out.push("Keine Verlinkung zu Social-Media-Profilen.");
  }

  if (pageSpeed?.performanceScore != null && pageSpeed.performanceScore < 50) {
    out.push(`Die Seite lädt auf dem Handy langsam (Performance-Wert ${pageSpeed.performanceScore} von 100).`);
  }

  return out.map((text) => ({ category: "technical" as const, text }));
}
