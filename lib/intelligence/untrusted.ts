/**
 * Texte von fremden Websites sind Daten, keine Anweisungen. Spitze Klammern werden ersetzt, damit
 * Website-Inhalt die Abgrenzung im Prompt (<website_text> …) nicht beenden oder nachahmen kann.
 */
export function sanitizeUntrusted(text: string): string {
  return text.replace(/</g, "‹").replace(/>/g, "›");
}
