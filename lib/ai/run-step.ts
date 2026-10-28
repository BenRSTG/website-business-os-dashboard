import "server-only";
import type { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAiConfig, resolveModel, type AiConfig } from "./config";
import { createAnthropicProvider } from "./anthropic";
import { estimateCostEur, estimateMaxCostEur } from "./pricing";
import {
  AiBudgetError,
  AiValidationError,
  type AiEffort,
  type AiImage,
  type AiProvider,
  type AiTier,
  type AiUsage,
} from "./types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface RunAiStepParams<T> {
  supabase: Supabase;
  userId: string;
  /** Kurzname des Schritts, erscheint als `ai.<step>` im audit_log */
  step: string;
  entityType: string;
  entityId: string;
  tier: AiTier;
  system: string;
  userText: string;
  images?: AiImage[];
  schema: z.ZodType<T>;
  effort?: AiEffort;
  maxTokens?: number;
  // Nur für Tests: vorgegebene Konfiguration und Provider.
  config?: AiConfig;
  provider?: AiProvider;
}

export interface AiStepResult<T> {
  output: T;
  model: string;
  costEur: number;
}

const LOG_TEXT_LIMIT = 8000;

async function assertWithinRateLimit(supabase: Supabase, maxRunsPerHour: number) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("audit_log")
    .select("id", { count: "exact", head: true })
    .like("action_type", "ai.%")
    .gte("created_at", since);
  if (error) throw new AiBudgetError("Das KI-Limit konnte nicht geprüft werden. Bitte später erneut versuchen.");
  if ((count ?? 0) >= maxRunsPerHour) {
    throw new AiBudgetError(
      `Stündliches KI-Limit erreicht (${maxRunsPerHour} Aufrufe). Bitte später erneut versuchen oder AI_MAX_RUNS_PER_HOUR erhöhen.`,
    );
  }
}

function addUsage(a: AiUsage, b?: AiUsage): AiUsage {
  return { tokensIn: a.tokensIn + (b?.tokensIn ?? 0), tokensOut: a.tokensOut + (b?.tokensOut ?? 0) };
}

export async function runAiStep<T>(params: RunAiStepParams<T>): Promise<AiStepResult<T>> {
  const config = params.config ?? getAiConfig();
  const model = resolveModel(params.tier, config);
  const effort = params.effort ?? (params.tier === "capable" ? "medium" : "low");
  const maxTokens = params.maxTokens ?? 4000;
  const images = params.images ?? [];

  await assertWithinRateLimit(params.supabase, config.maxRunsPerHour);

  const worstCase = estimateMaxCostEur({
    model,
    textChars: params.system.length + params.userText.length,
    imageCount: images.length,
    maxTokens,
    usdEurRate: config.usdEurRate,
  });
  if (worstCase > config.maxCostPerRunEur) {
    throw new AiBudgetError(
      `Dieser KI-Aufruf könnte bis zu ${worstCase.toFixed(2)} € kosten und überschreitet den Kostendeckel von ${config.maxCostPerRunEur.toFixed(2)} € (AI_MAX_COST_PER_RUN_EUR).`,
    );
  }

  const provider = params.provider ?? createAnthropicProvider(config.apiKey);

  let usage: AiUsage = { tokensIn: 0, tokensOut: 0 };
  let usedModel = model;
  let attempts = 0;
  let correction = "";
  let outcome: { ok: true; output: T } | { ok: false; error: unknown } = {
    ok: false,
    error: new Error("nicht ausgeführt"),
  };

  // Ein Korrektur-Versuch bei ungültigem Format, danach Abbruch statt stillem Weiterlaufen (docs/08-ki-architektur.md §2).
  for (attempts = 1; attempts <= 2; attempts++) {
    try {
      const result = await provider.call({
        model,
        system: params.system,
        userText: params.userText + correction,
        images,
        schema: params.schema,
        effort,
        maxTokens,
      });
      usage = addUsage(usage, result);
      usedModel = result.model;
      outcome = { ok: true, output: result.output };
      break;
    } catch (error) {
      if (error instanceof AiValidationError) {
        usage = addUsage(usage, error.usage);
        outcome = { ok: false, error };
        correction = `\n\nHinweis: Deine letzte Antwort war nicht verwertbar (${error.message}). Antworte erneut und halte dich exakt an das vorgegebene Format.`;
        continue;
      }
      outcome = { ok: false, error };
      break;
    }
  }

  const costEur = estimateCostEur(usedModel, usage, config.usdEurRate);

  // Jeder Aufruf wird protokolliert — auch fehlgeschlagene, denn sie kosten und zählen zum Stunden-Limit.
  const { error: logError } = await params.supabase.from("audit_log").insert({
    actor: "SYSTEM_AI",
    user_id: params.userId,
    action_type: `ai.${params.step}`,
    entity_type: params.entityType,
    entity_id: params.entityId,
    input: {
      system: params.system.slice(0, LOG_TEXT_LIMIT),
      user: params.userText.slice(0, LOG_TEXT_LIMIT),
      images: images.length,
      attempts: Math.min(attempts, 2),
    },
    output: outcome.ok
      ? (outcome.output as unknown)
      : { error: outcome.error instanceof Error ? outcome.error.message : "unbekannter Fehler" },
    model_used: usedModel,
    cost_estimate: costEur,
    requires_approval: false,
  });
  if (logError) console.error("audit_log-Eintrag fehlgeschlagen:", logError.message);

  if (!outcome.ok) throw outcome.error;
  return { output: outcome.output, model: usedModel, costEur };
}
