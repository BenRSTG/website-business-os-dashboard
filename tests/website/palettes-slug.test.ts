import { describe, expect, it } from "vitest";
import { PALETTE_IDS, paletteIdsFor, tokensFor } from "@/lib/website/palettes";
import { PREVIEW_SLUG_PATTERN, previewSlug, slugify } from "@/lib/website/slug";
import { SITE_STYLES, contrastIssues, designTokensSchema, labelColor, contrastRatio } from "@/lib/website/tokens";

describe("Paletten", () => {
  it("jede Palette ergibt gültige, lesbare Tokens", () => {
    for (const style of SITE_STYLES) {
      for (const id of paletteIdsFor(style)) {
        const tokens = tokensFor(style, id);
        expect(designTokensSchema.safeParse(tokens).success, id).toBe(true);
        expect(contrastIssues(tokens), id).toEqual([]);
        expect(contrastRatio(labelColor(tokens), tokens.background_color), id).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("Kennungen sind eindeutig und beginnen mit dem Stilnamen", () => {
    expect(new Set(PALETTE_IDS).size).toBe(PALETTE_IDS.length);
    for (const style of SITE_STYLES) for (const id of paletteIdsFor(style)) expect(id.startsWith(style)).toBe(true);
  });

  it("unbekannte oder fremde Palette fällt auf die erste des Stils zurück", () => {
    expect(tokensFor("modern", "premium-01").palette_id).toBe("modern-01");
    expect(tokensFor("premium", null).palette_id).toBe("premium-01");
  });
});

describe("Vorschau-Adresse", () => {
  it("wandelt Umlaute und Sonderzeichen um", () => {
    expect(slugify("Müller & Söhne Dachdecker GmbH")).toBe("mueller-soehne-dachdecker-gmbh");
    expect(slugify("  Ärger-Weiß  ")).toBe("aerger-weiss");
  });

  it("erzeugt gültige Adressen mit zufälligem Anhang", () => {
    const slugs = Array.from({ length: 50 }, () => previewSlug("Elektro Weber"));
    for (const s of slugs) {
      expect(s).toMatch(PREVIEW_SLUG_PATTERN);
      expect(s).toMatch(/^elektro-weber-[a-z2-9]{6}$/);
    }
    expect(new Set(slugs).size).toBe(50);
  });

  it("bleibt auch bei langen oder leeren Namen im erlaubten Rahmen", () => {
    expect(previewSlug("A".repeat(200))).toMatch(PREVIEW_SLUG_PATTERN);
    expect(previewSlug("!!!")).toMatch(/^demo-[a-z2-9]{6}$/);
    expect(previewSlug("A".repeat(200)).length).toBeLessThanOrEqual(63);
  });
});
