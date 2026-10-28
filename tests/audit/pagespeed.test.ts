import { describe, expect, it } from "vitest";
import { PageSpeedError, fetchPageSpeed, parsePageSpeedResponse } from "@/lib/audit/pagespeed";

const lighthouse = (audits: Record<string, unknown>, perf: number | null = 0.42) => ({
  lighthouseResult: { categories: { performance: { score: perf } }, audits },
});

describe("parsePageSpeedResponse", () => {
  it("rechnet Performance und Mobile-Tauglichkeit in Prozent", () => {
    const result = parsePageSpeedResponse(
      lighthouse({ viewport: { score: 1 }, "font-size": { score: 0.5 }, "tap-targets": { score: 0 } }),
    );
    expect(result.performanceScore).toBe(42);
    expect(result.mobileScore).toBe(50);
  });

  it("liest die Prüfpunkte von Lighthouse 13 (viewport-insight, target-size) und ignoriert nicht anwendbare", () => {
    const result = parsePageSpeedResponse(
      lighthouse({
        "viewport-insight": { score: 0.5 },
        "target-size": { score: 1 },
        "meta-viewport": { score: null },
        "image-size-responsive": { score: 0 },
      }),
    );
    expect(result.mobileScore).toBe(75);
  });

  it("nutzt nur vorhandene Mobile-Audits (ältere Lighthouse-Versionen)", () => {
    expect(parsePageSpeedResponse(lighthouse({ viewport: { score: 1 } })).mobileScore).toBe(100);
  });

  it("liefert null statt zu raten, wenn nichts gemessen wurde", () => {
    const result = parsePageSpeedResponse(lighthouse({}, null));
    expect(result.performanceScore).toBeNull();
    expect(result.mobileScore).toBeNull();
    expect(result.screenshotDataUri).toBeNull();
  });

  it("übernimmt den Screenshot nur als Bild-Data-URI in vertretbarer Größe", () => {
    const ok = "data:image/jpeg;base64,AAAA";
    expect(parsePageSpeedResponse(lighthouse({ "final-screenshot": { details: { data: ok } } })).screenshotDataUri).toBe(ok);
    expect(
      parsePageSpeedResponse(lighthouse({ "final-screenshot": { details: { data: "https://böse.example/x" } } })).screenshotDataUri,
    ).toBeNull();
    const huge = "data:image/jpeg;base64," + "A".repeat(700_000);
    expect(parsePageSpeedResponse(lighthouse({ "final-screenshot": { details: { data: huge } } })).screenshotDataUri).toBeNull();
  });

  it("wirft bei unbrauchbarer Antwort", () => {
    expect(() => parsePageSpeedResponse({ error: "x" })).toThrow(PageSpeedError);
    expect(() => parsePageSpeedResponse(null)).toThrow(PageSpeedError);
  });
});

describe("fetchPageSpeed", () => {
  const respond = (status: number, body: unknown = {}) =>
    (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

  it("übergibt Adresse, Strategie und Key", async () => {
    let requested = "";
    const spy = (async (input: URL | string) => {
      requested = String(input);
      return new Response(JSON.stringify(lighthouse({ viewport: { score: 1 } })), { status: 200 });
    }) as unknown as typeof fetch;
    await fetchPageSpeed("https://example.com", "KEY123", spy);
    expect(requested).toContain("strategy=mobile");
    expect(requested).toContain("category=performance");
    expect(requested).toContain("category=accessibility");
    expect(requested).toContain("url=https%3A%2F%2Fexample.com");
    expect(requested).toContain("key=KEY123");
  });

  it("meldet erschöpftes Kontingent verständlich", async () => {
    await expect(fetchPageSpeed("https://example.com", undefined, respond(429))).rejects.toThrow(/Kontingent/);
  });

  it("meldet andere Fehlerstatus", async () => {
    await expect(fetchPageSpeed("https://example.com", undefined, respond(500))).rejects.toThrow(/500/);
  });
});
