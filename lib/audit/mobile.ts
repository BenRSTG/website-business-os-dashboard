/**
 * Mobile-Tauglichkeit (0–100) als Mittel aller verfügbaren Teilsignale, z. B. der PageSpeed-Prüfpunkte und
 * dem Viewport-Hinweis im Quelltext (100 vorhanden, 0 fehlt). Ohne ein einziges Signal bleibt sie ungemessen (null).
 */
export function combineMobileScore(parts: (number | null | undefined)[]): number | null {
  const present = parts.filter((p): p is number => typeof p === "number");
  if (present.length === 0) return null;
  return Math.round(present.reduce((sum, p) => sum + p, 0) / present.length);
}
