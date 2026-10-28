// KOPIE aus site-engine/lib/tokens.ts — bei Änderungen beide Dateien angleichen (Abgleich über tests/website/schema-drift.test.ts).
import { z } from "zod";

export const FONT_KEYS = ["archivo", "plex-sans", "source-serif", "fraunces"] as const;
export type FontKey = (typeof FONT_KEYS)[number];
export const RADIUS_VALUES = ["0px", "4px", "8px", "12px", "16px"] as const;
export const SHADOW_STYLES = ["none", "soft", "sharp"] as const;
export const BUTTON_STYLES = ["solid-round", "solid-square", "outline-square"] as const;
export const SPACING_SCALES = ["compact", "normal", "airy"] as const;
export const SITE_STYLES = ["modern", "traditional", "premium"] as const;
export type SiteStyle = (typeof SITE_STYLES)[number];

// Nur strikte Hex-Farben und feste Listen: Token-Werte landen im style-Attribut, nie als freier Text.
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Farbe muss #RRGGBB sein");

export const designTokensSchema = z.object({
  palette_id: z.string().min(1).max(60),
  primary_color: hex,
  accent_color: hex,
  background_color: hex,
  surface_color: hex,
  text_color: hex,
  muted_color: hex,
  border_color: hex,
  font_headline: z.enum(FONT_KEYS),
  font_body: z.enum(FONT_KEYS),
  radius: z.enum(RADIUS_VALUES),
  shadow_style: z.enum(SHADOW_STYLES),
  button_style: z.enum(BUTTON_STYLES),
  spacing_scale: z.enum(SPACING_SCALES),
});
export type DesignTokens = z.infer<typeof designTokensSchema>;

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(color: string): number {
  const n = parseInt(color.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** WCAG-Kontrastverhältnis, 1 bis 21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Lesbare Schriftfarbe (hell oder dunkel) auf einem Hintergrund. */
export function onColor(background: string): "#ffffff" | "#111111" {
  return contrastRatio(background, "#ffffff") >= contrastRatio(background, "#111111") ? "#ffffff" : "#111111";
}

/** Meldet Kontrastprobleme (WCAG AA) — für die Qualitätsprüfung der Pipeline, blockiert das Rendern nicht. */
export function contrastIssues(tokens: DesignTokens): string[] {
  const issues: string[] = [];
  const check = (label: string, fg: string, bg: string, min: number) => {
    const ratio = contrastRatio(fg, bg);
    if (ratio < min) issues.push(`${label}: Kontrast ${ratio.toFixed(2)} (mind. ${min})`);
  };
  check("Text auf Hintergrund", tokens.text_color, tokens.background_color, 4.5);
  check("Text auf Fläche", tokens.text_color, tokens.surface_color, 4.5);
  check("Zurückhaltender Text auf Hintergrund", tokens.muted_color, tokens.background_color, 4.5);
  return issues;
}

const SHADOWS: Record<DesignTokens["shadow_style"], string> = {
  none: "none",
  soft: "0 1px 2px rgb(0 0 0 / 0.06), 0 10px 28px rgb(0 0 0 / 0.08)",
  sharp: "4px 4px 0 rgb(0 0 0 / 0.14)",
};

const SPACING: Record<DesignTokens["spacing_scale"], string> = {
  compact: "3.5rem",
  normal: "5rem",
  airy: "7rem",
};

const FONT_STACKS: Record<FontKey, string> = {
  archivo: "var(--font-archivo), ui-sans-serif, system-ui, sans-serif",
  "plex-sans": "var(--font-plex-sans), ui-sans-serif, system-ui, sans-serif",
  "source-serif": "var(--font-source-serif), Georgia, 'Times New Roman', serif",
  fraunces: "var(--font-fraunces), Georgia, 'Times New Roman', serif",
};

const HEADING: Record<SiteStyle, { weight: string; tracking: string }> = {
  modern: { weight: "700", tracking: "-0.02em" },
  traditional: { weight: "600", tracking: "0" },
  premium: { weight: "500", tracking: "0.01em" },
};

/** Farbe für kleine Auszeichnungstexte: die erste von Akzent, Primär, Text, die auf Hintergrund und Fläche lesbar ist. */
export function labelColor(tokens: DesignTokens): string {
  const readable = (c: string) =>
    contrastRatio(c, tokens.background_color) >= 4.5 && contrastRatio(c, tokens.surface_color) >= 4.5;
  return [tokens.accent_color, tokens.primary_color].find(readable) ?? tokens.text_color;
}

export function tokensToCssVars(tokens: DesignTokens, style: SiteStyle): Record<string, string> {
  const onPrimary = onColor(tokens.primary_color);
  const outline = tokens.button_style === "outline-square";
  const focus =
    contrastRatio(tokens.primary_color, tokens.background_color) >= 3 ? tokens.primary_color : tokens.text_color;

  return {
    "--t-primary": tokens.primary_color,
    "--t-on-primary": onPrimary,
    "--t-accent": tokens.accent_color,
    "--t-on-accent": onColor(tokens.accent_color),
    "--t-label": labelColor(tokens),
    "--t-background": tokens.background_color,
    "--t-surface": tokens.surface_color,
    "--t-text": tokens.text_color,
    "--t-muted": tokens.muted_color,
    "--t-border": tokens.border_color,
    "--t-focus": focus,
    "--t-radius": tokens.radius,
    "--t-shadow": SHADOWS[tokens.shadow_style],
    "--t-section-y": SPACING[tokens.spacing_scale],
    "--t-font-headline": FONT_STACKS[tokens.font_headline],
    "--t-font-body": FONT_STACKS[tokens.font_body],
    "--t-heading-weight": HEADING[style].weight,
    "--t-heading-tracking": HEADING[style].tracking,
    "--t-btn-bg": outline ? "transparent" : tokens.primary_color,
    "--t-btn-fg": outline ? tokens.accent_color : onPrimary,
    "--t-btn-border": outline ? tokens.accent_color : "transparent",
    "--t-btn-hover-bg": outline ? "color-mix(in srgb, var(--t-accent) 14%, transparent)" : tokens.primary_color,
    "--t-btn-radius": tokens.button_style === "solid-round" ? "9999px" : tokens.radius,
  };
}

export const STYLE_PRESETS: Record<SiteStyle, DesignTokens> = {
  modern: {
    palette_id: "modern-01",
    primary_color: "#2B5C99",
    accent_color: "#E0A83C",
    background_color: "#FFFFFF",
    surface_color: "#F3F5F4",
    text_color: "#1B2430",
    muted_color: "#55606B",
    border_color: "#DCE1E0",
    font_headline: "archivo",
    font_body: "plex-sans",
    radius: "12px",
    shadow_style: "soft",
    button_style: "solid-round",
    spacing_scale: "normal",
  },
  traditional: {
    palette_id: "traditional-01",
    primary_color: "#2D5A46",
    accent_color: "#B07D2B",
    background_color: "#F8F7F3",
    surface_color: "#EFEDE6",
    text_color: "#23261F",
    muted_color: "#565A4F",
    border_color: "#D6D3C7",
    font_headline: "source-serif",
    font_body: "plex-sans",
    radius: "4px",
    shadow_style: "none",
    button_style: "solid-square",
    spacing_scale: "normal",
  },
  premium: {
    palette_id: "premium-01",
    primary_color: "#C6A664",
    accent_color: "#D9BF86",
    background_color: "#111315",
    surface_color: "#1A1D20",
    text_color: "#ECEAE4",
    muted_color: "#A9A79F",
    border_color: "#2E3135",
    font_headline: "fraunces",
    font_body: "plex-sans",
    radius: "0px",
    shadow_style: "none",
    button_style: "outline-square",
    spacing_scale: "airy",
  },
};
