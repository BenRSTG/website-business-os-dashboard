import { z } from "zod";
import { SCHEMES, type Scheme } from "./palettes";
import { DEFAULT_PACKAGE, normalizePackage, type SitePackage } from "./packages";
import { SITE_STYLES, type SiteStyle } from "./tokens";

/** Auswahl vor dem Start: Paket plus Stil und Farbwelt (null = die KI entscheidet). */
export interface DemoOptions {
  package: SitePackage;
  style: SiteStyle | null;
  scheme: Scheme | null;
}

export const DEFAULT_OPTIONS: DemoOptions = { package: DEFAULT_PACKAGE, style: null, scheme: null };

const optionsSchema = z.object({
  package: z.unknown().optional(),
  style: z.enum(SITE_STYLES).nullish().catch(null),
  scheme: z.enum(SCHEMES as unknown as [Scheme, ...Scheme[]]).nullish().catch(null),
});

/** Unbrauchbare Werte fallen auf den Standard zurück (Paket Profi, Stil und Farbwelt automatisch). */
export function normalizeOptions(input: unknown): DemoOptions {
  const parsed = optionsSchema.safeParse(input ?? {});
  if (!parsed.success) return DEFAULT_OPTIONS;
  return {
    package: normalizePackage(parsed.data.package),
    style: parsed.data.style ?? null,
    scheme: parsed.data.scheme ?? null,
  };
}
