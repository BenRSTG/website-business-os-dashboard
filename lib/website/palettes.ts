import { STYLE_PRESETS, type DesignTokens, type SiteStyle } from "./tokens";

// Feste, geprüfte Paletten je Stil. Die KI wählt nur eine Kennung — nie freie Farbwerte —, damit Kontrast und
// Lesbarkeit garantiert sind (Test: tests/website/palettes.test.ts). Schriften, Radius und Schatten bleiben je Stil fest.
type Colors = Pick<
  DesignTokens,
  | "palette_id"
  | "primary_color"
  | "accent_color"
  | "background_color"
  | "surface_color"
  | "text_color"
  | "muted_color"
  | "border_color"
>;

const COLORS: Record<SiteStyle, Colors[]> = {
  modern: [
    { ...pick(STYLE_PRESETS.modern) },
    {
      palette_id: "modern-02",
      primary_color: "#1F7A5C",
      accent_color: "#F2A541",
      background_color: "#FFFFFF",
      surface_color: "#F2F6F4",
      text_color: "#172019",
      muted_color: "#4F5D55",
      border_color: "#D9E2DD",
    },
    {
      palette_id: "modern-03",
      primary_color: "#C2410C",
      accent_color: "#0F766E",
      background_color: "#FFFFFF",
      surface_color: "#F6F4F2",
      text_color: "#1F1B18",
      muted_color: "#5C554F",
      border_color: "#E3DDD7",
    },
  ],
  traditional: [
    { ...pick(STYLE_PRESETS.traditional) },
    {
      palette_id: "traditional-02",
      primary_color: "#7A2E2E",
      accent_color: "#A27B2C",
      background_color: "#FAF7F2",
      surface_color: "#F1EBE1",
      text_color: "#2B2420",
      muted_color: "#5F544B",
      border_color: "#DDD3C4",
    },
    {
      palette_id: "traditional-03",
      primary_color: "#1E3A5F",
      accent_color: "#9A6B1F",
      background_color: "#F7F6F2",
      surface_color: "#ECEAE2",
      text_color: "#1D2430",
      muted_color: "#535B67",
      border_color: "#D5D2C6",
    },
  ],
  premium: [
    { ...pick(STYLE_PRESETS.premium) },
    {
      palette_id: "premium-02",
      primary_color: "#8FB4E8",
      accent_color: "#C9D6EA",
      background_color: "#0F1318",
      surface_color: "#181E26",
      text_color: "#E8ECF2",
      muted_color: "#A3ADBB",
      border_color: "#2A333F",
    },
    {
      palette_id: "premium-03",
      primary_color: "#D08A5B",
      accent_color: "#E3B592",
      background_color: "#14110F",
      surface_color: "#1D1916",
      text_color: "#EFE9E2",
      muted_color: "#AFA59A",
      border_color: "#302A25",
    },
  ],
};

function pick(t: DesignTokens): Colors {
  return {
    palette_id: t.palette_id,
    primary_color: t.primary_color,
    accent_color: t.accent_color,
    background_color: t.background_color,
    surface_color: t.surface_color,
    text_color: t.text_color,
    muted_color: t.muted_color,
    border_color: t.border_color,
  };
}

export const PALETTE_IDS = Object.values(COLORS).flatMap((list) => list.map((c) => c.palette_id)) as [string, ...string[]];

export function paletteIdsFor(style: SiteStyle): string[] {
  return COLORS[style].map((c) => c.palette_id);
}

/** Vollständige Tokens: Stil-Voreinstellung (Schrift, Radius, Schatten, Buttons) plus die gewählte Palette des Stils. */
export function tokensFor(style: SiteStyle, paletteId: string | null | undefined): DesignTokens {
  const colors = COLORS[style].find((c) => c.palette_id === paletteId) ?? COLORS[style][0];
  return { ...STYLE_PRESETS[style], ...colors };
}
