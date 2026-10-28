import { STYLE_PRESETS, type DesignTokens, type SiteStyle } from "./tokens";

// Feste, geprüfte Paletten je Stil. Die KI wählt nur eine Kennung — nie freie Farbwerte —, damit Kontrast und
// Lesbarkeit garantiert sind (Test: tests/website/palettes.test.ts). Schriften, Radius und Schatten bleiben je Stil fest.
export type Scheme = "light" | "dark";
export const SCHEMES: readonly Scheme[] = ["light", "dark"];

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
> & { scheme: Scheme };

const COLORS: Record<SiteStyle, Colors[]> = {
  modern: [
    { ...pick(STYLE_PRESETS.modern, "light") },
    {
      palette_id: "modern-02",
      scheme: "light",
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
      scheme: "light",
      primary_color: "#C2410C",
      accent_color: "#0F766E",
      background_color: "#FFFFFF",
      surface_color: "#F6F4F2",
      text_color: "#1F1B18",
      muted_color: "#5C554F",
      border_color: "#E3DDD7",
    },
    {
      palette_id: "modern-04",
      scheme: "dark",
      primary_color: "#6AA5E8",
      accent_color: "#F2C14E",
      background_color: "#0E1620",
      surface_color: "#162231",
      text_color: "#E9EEF5",
      muted_color: "#A6B2C2",
      border_color: "#263447",
    },
    {
      palette_id: "modern-05",
      scheme: "dark",
      primary_color: "#4FC08D",
      accent_color: "#F2A541",
      background_color: "#0D1714",
      surface_color: "#15231E",
      text_color: "#E8F1ED",
      muted_color: "#A3B5AC",
      border_color: "#25382F",
    },
  ],
  traditional: [
    { ...pick(STYLE_PRESETS.traditional, "light") },
    {
      palette_id: "traditional-02",
      scheme: "light",
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
      scheme: "light",
      primary_color: "#1E3A5F",
      accent_color: "#9A6B1F",
      background_color: "#F7F6F2",
      surface_color: "#ECEAE2",
      text_color: "#1D2430",
      muted_color: "#535B67",
      border_color: "#D5D2C6",
    },
    {
      palette_id: "traditional-04",
      scheme: "dark",
      primary_color: "#8FBF9F",
      accent_color: "#D2A24A",
      background_color: "#1A1C17",
      surface_color: "#23261F",
      text_color: "#EFEDE4",
      muted_color: "#B0AEA0",
      border_color: "#3A3D33",
    },
    {
      palette_id: "traditional-05",
      scheme: "dark",
      primary_color: "#D98C8C",
      accent_color: "#D2A24A",
      background_color: "#1E1816",
      surface_color: "#2A211F",
      text_color: "#F1E9E4",
      muted_color: "#B8A9A2",
      border_color: "#43352F",
    },
  ],
  premium: [
    { ...pick(STYLE_PRESETS.premium, "dark") },
    {
      palette_id: "premium-02",
      scheme: "dark",
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
      scheme: "dark",
      primary_color: "#D08A5B",
      accent_color: "#E3B592",
      background_color: "#14110F",
      surface_color: "#1D1916",
      text_color: "#EFE9E2",
      muted_color: "#AFA59A",
      border_color: "#302A25",
    },
    {
      palette_id: "premium-04",
      scheme: "light",
      primary_color: "#7A5C14",
      accent_color: "#7A5C14",
      background_color: "#FAF8F3",
      surface_color: "#F0ECE2",
      text_color: "#1F1D18",
      muted_color: "#5B574C",
      border_color: "#DAD4C4",
    },
    {
      palette_id: "premium-05",
      scheme: "light",
      primary_color: "#1E3A5F",
      accent_color: "#1E3A5F",
      background_color: "#F6F7F9",
      surface_color: "#ECEFF3",
      text_color: "#151A22",
      muted_color: "#4C5666",
      border_color: "#D3D9E2",
    },
  ],
};

function pick(t: DesignTokens, scheme: Scheme): Colors {
  return {
    scheme,
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

export function paletteIdsFor(style: SiteStyle, scheme?: Scheme | null): string[] {
  return COLORS[style].filter((c) => !scheme || c.scheme === scheme).map((c) => c.palette_id);
}

export function schemeOf(style: SiteStyle, paletteId: string): Scheme | null {
  return COLORS[style].find((c) => c.palette_id === paletteId)?.scheme ?? null;
}

/** Vollständige Tokens: Stil-Voreinstellung (Schrift, Radius, Schatten, Buttons) plus die gewählte Palette des Stils. */
export function tokensFor(style: SiteStyle, paletteId: string | null | undefined): DesignTokens {
  const { scheme: _scheme, ...colors } = COLORS[style].find((c) => c.palette_id === paletteId) ?? COLORS[style][0];
  void _scheme;
  return { ...STYLE_PRESETS[style], ...colors };
}
