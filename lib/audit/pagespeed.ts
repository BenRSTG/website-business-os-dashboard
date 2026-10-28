import "server-only";
import { z } from "zod";

export class PageSpeedError extends Error {}

export interface PageSpeedResult {
  performanceScore: number | null;
  mobileScore: number | null;
  screenshotDataUri: string | null;
}

const MAX_SCREENSHOT_CHARS = 600_000;
// Lighthouse 13 hat "viewport", "font-size" und "tap-targets" ersetzt: heute liefert "viewport-insight" (Performance-Kategorie)
// und "target-size" (Kategorie accessibility) die Mobile-Signale. Die alten IDs bleiben für ältere Lighthouse-Versionen.
const MOBILE_AUDITS = ["viewport-insight", "target-size", "viewport", "font-size", "tap-targets"] as const;

const responseSchema = z.object({
  lighthouseResult: z
    .object({
      categories: z
        .object({ performance: z.object({ score: z.number().nullable().optional() }).optional() })
        .optional(),
      audits: z
        .record(
          z.string(),
          z.object({
            score: z.number().nullable().optional(),
            details: z.object({ data: z.string().optional() }).passthrough().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

const toPercent = (score: number | null | undefined) =>
  typeof score === "number" ? Math.round(Math.min(1, Math.max(0, score)) * 100) : null;

export function parsePageSpeedResponse(json: unknown): PageSpeedResult {
  const parsed = responseSchema.safeParse(json);
  const lighthouse = parsed.success ? parsed.data.lighthouseResult : undefined;
  if (!lighthouse) throw new PageSpeedError("PageSpeed lieferte kein verwertbares Ergebnis.");

  const mobileScores = MOBILE_AUDITS.map((id) => lighthouse.audits?.[id]?.score).filter(
    (s): s is number => typeof s === "number",
  );
  const mobileScore = mobileScores.length
    ? Math.round((mobileScores.reduce((a, b) => a + b, 0) / mobileScores.length) * 100)
    : null;

  const data = lighthouse.audits?.["final-screenshot"]?.details?.data;
  const screenshotDataUri =
    data && /^data:image\/(jpeg|png|webp);base64,/.test(data) && data.length <= MAX_SCREENSHOT_CHARS
      ? data
      : null;

  return {
    performanceScore: toPercent(lighthouse.categories?.performance?.score),
    mobileScore,
    screenshotDataUri,
  };
}

export async function fetchPageSpeed(
  url: string,
  apiKey: string | undefined,
  fetchFn: typeof fetch = fetch,
): Promise<PageSpeedResult> {
  const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("strategy", "mobile");
  endpoint.searchParams.append("category", "performance");
  endpoint.searchParams.append("category", "accessibility");
  if (apiKey) endpoint.searchParams.set("key", apiKey);

  let response: Response;
  try {
    response = await fetchFn(endpoint, { signal: AbortSignal.timeout(60_000) });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new PageSpeedError("PageSpeed hat nicht rechtzeitig geantwortet.");
    }
    throw new PageSpeedError("PageSpeed konnte nicht erreicht werden.");
  }

  if (response.status === 429) {
    throw new PageSpeedError("PageSpeed-Kontingent erschöpft. Später erneut versuchen oder einen API-Key hinterlegen.");
  }
  if (!response.ok) {
    throw new PageSpeedError(`PageSpeed antwortet mit Fehler ${response.status}.`);
  }
  return parsePageSpeedResponse(await response.json());
}
