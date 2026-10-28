import { z } from "zod";
import { AiConfigError, type AiTier } from "./types";

const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const schema = z.object({
  ANTHROPIC_API_KEY: z.string().min(10),
  AI_MODEL_CAPABLE: z.string().min(3),
  AI_MODEL_CHEAP: z.string().min(3),
  AI_MAX_RUNS_PER_HOUR: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().default(20)),
  AI_MAX_COST_PER_RUN_EUR: z.preprocess(emptyToUndefined, z.coerce.number().positive().default(1)),
  AI_MAX_COST_PER_DEMO_EUR: z.preprocess(emptyToUndefined, z.coerce.number().positive().default(2)),
  AI_USD_EUR_RATE: z.preprocess(emptyToUndefined, z.coerce.number().positive().default(0.92)),
});

export interface AiConfig {
  apiKey: string;
  models: Record<AiTier, string>;
  maxRunsPerHour: number;
  maxCostPerRunEur: number;
  /** Gesamtdeckel einer Website-Demo (alle Schritte zusammen) */
  maxCostPerDemoEur: number;
  usdEurRate: number;
}

// Bewusst lazy: ohne KI-Schlüssel startet die App trotzdem, nur die KI-Funktionen melden sich mit klarem Hinweis.
export function getAiConfig(env: Record<string, string | undefined> = process.env): AiConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const missing = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))].join(", ");
    throw new AiConfigError(
      `Die KI ist noch nicht eingerichtet. Bitte diese Umgebungsvariablen setzen: ${missing}.`,
    );
  }
  const e = parsed.data;
  return {
    apiKey: e.ANTHROPIC_API_KEY,
    models: { capable: e.AI_MODEL_CAPABLE, cheap: e.AI_MODEL_CHEAP },
    maxRunsPerHour: e.AI_MAX_RUNS_PER_HOUR,
    maxCostPerRunEur: e.AI_MAX_COST_PER_RUN_EUR,
    maxCostPerDemoEur: e.AI_MAX_COST_PER_DEMO_EUR,
    usdEurRate: e.AI_USD_EUR_RATE,
  };
}

/** Modellnamen stehen ausschließlich in der Konfiguration, nie im Pipeline-Code. */
export function resolveModel(tier: AiTier, config: AiConfig): string {
  return config.models[tier];
}
