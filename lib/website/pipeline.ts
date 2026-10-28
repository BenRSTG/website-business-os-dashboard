import type { z } from "zod";
import { estimateMaxCostEur } from "@/lib/ai/pricing";
import { AiBudgetError, type AiTier } from "@/lib/ai/types";
import type { CompanyProfileRow } from "@/lib/intelligence/types";
import type { Lead } from "@/lib/leads/types";
import { composePages, type PageDraft } from "./compose";
import { DEFAULT_FEATURES, needsFeatureCopy, type Feature } from "./features";
import { DEFAULT_OPTIONS, type DemoOptions } from "./options";
import { hasMotion, isOnePager, type SitePackage } from "./packages";
import { paletteIdsFor, tokensFor } from "./palettes";
import {
  HOME_SYSTEM_PROMPT,
  LEISTUNGEN_SYSTEM_PROMPT,
  FEATURES_SYSTEM_PROMPT,
  PLAN_SYSTEM_PROMPT,
  SEO_SYSTEM_PROMPT,
  buildBrief,
  buildFeaturesUserText,
  buildPlanConstraints,
  buildSeoUserText,
  featureCopySchema,
  homeCopySchema,
  leistungenCopySchema,
  planSchema,
  seoOutputSchema,
  type FeatureCopy,
  type HomeCopy,
  type LeistungenCopy,
  type Plan,
  type SeoOutput,
} from "./prompts";
import { checkQuality, type QualityReport } from "./quality";
import type { StepId } from "./steps";
import type { DesignTokens, SiteStyle } from "./tokens";



/** Zwischenstand eines Laufs (steht in site_generation_runs.state) */
export interface RunState {
  /** Paket, Stil und Farbwelt (Etappe 4D); ohne Angabe gilt der Standard */
  options?: DemoOptions;
  /** Gewählte Bausteine (Etappe 4C); ohne Angabe gilt der Standard */
  features?: Feature[];
  featureCopy?: FeatureCopy | null;
  plan?: Plan;
  home?: HomeCopy;
  leistungen?: LeistungenCopy;
  seo?: SeoOutput | null;
}

export interface AiCallArgs<T> {
  step: string;
  tier: AiTier;
  system: string;
  userText: string;
  schema: z.ZodType<T>;
  maxTokens: number;
}

export type RunAi = <T>(args: AiCallArgs<T>) => Promise<{ output: T; costEur: number }>;

export interface StepContext {
  lead: Lead;
  profile: CompanyProfileRow;
  state: RunState;
  runAi: RunAi;
}

/** Vor jedem KI-Schritt: reicht der Deckel der Demo noch für den teuersten denkbaren Fall dieses Aufrufs? */
export function assertDemoBudget(params: {
  spentEur: number;
  maxDemoEur: number;
  model: string;
  textChars: number;
  maxTokens: number;
  usdEurRate: number;
}): void {
  const worst = estimateMaxCostEur({
    model: params.model,
    textChars: params.textChars,
    imageCount: 0,
    maxTokens: params.maxTokens,
    usdEurRate: params.usdEurRate,
  });
  if (params.spentEur + worst > params.maxDemoEur) {
    throw new AiBudgetError(
      `Der Kostendeckel für diese Demo (${params.maxDemoEur.toFixed(2)} €, AI_MAX_COST_PER_DEMO_EUR) würde überschritten: bisher ${params.spentEur.toFixed(2)} €, der nächste Schritt könnte bis zu ${worst.toFixed(2)} € kosten. Der Lauf wurde angehalten.`,
    );
  }
}

/**
 * Die Wahl der KI wird gegen die feste Liste geprüft; Festlegungen des Nutzers (Stil, Farbwelt) setzen sich immer durch.
 * Passt die Palette nicht zu Stil und Farbwelt, gilt die erste passende.
 */
export function normalizePlan(plan: Plan, options: Pick<DemoOptions, "style" | "scheme"> = { style: null, scheme: null }): Plan {
  const style = options.style ?? plan.style;
  const matching = paletteIdsFor(style, options.scheme);
  const valid = matching.length > 0 ? matching : paletteIdsFor(style);
  return { ...plan, style, palette_id: valid.includes(plan.palette_id) ? plan.palette_id : valid[0] };
}

export interface AssembleResult {
  style: SiteStyle;
  tokens: DesignTokens;
  pages: PageDraft[];
  report: QualityReport;
  package: SitePackage;
}

const FAILED = "Schritt wurde noch nicht ausgeführt";

export function assemble(lead: Lead, profile: CompanyProfileRow, state: RunState): AssembleResult {
  const options = state.options ?? DEFAULT_OPTIONS;
  const onePager = isOnePager(options.package);
  if (!state.plan || !state.home || (!onePager && !state.leistungen)) throw new Error(`${FAILED} (Stil oder Texte fehlen)`);
  const plan = normalizePlan(state.plan, options);
  // Premium: großzügigere Abstände (die Bewegung schaltet der site-engine über das Paket)
  const tokens = { ...tokensFor(plan.style, plan.palette_id), ...(hasMotion(options.package) ? { spacing_scale: "airy" as const } : {}) };
  const pages = composePages({
    lead,
    plan,
    style: plan.style,
    home: state.home,
    leistungen: state.leistungen ?? null,
    seo: state.seo ?? null,
    package: options.package,
    features: state.features ?? DEFAULT_FEATURES,
    featureCopy: state.featureCopy ?? null,
  });
  const report = checkQuality({
    package: options.package,
    lead,
    facts: profile.facts,
    tokens,
    pages,
    aiCopy: { home: state.home, leistungen: state.leistungen, featureCopy: state.featureCopy ?? null, seo: state.seo ?? null },
  });
  return { style: plan.style, tokens, pages, report, package: options.package };
}

/** Führt einen KI-Schritt aus und liefert den neuen Zwischenstand. `assemble` ist kein KI-Schritt (siehe assemble()). */
export async function executeAiStep(
  step: Exclude<StepId, "assemble">,
  ctx: StepContext,
): Promise<{ state: RunState; costEur: number }> {
  const { lead, profile, state, runAi } = ctx;
  const brief = buildBrief(lead, profile);
  const options = state.options ?? DEFAULT_OPTIONS;

  switch (step) {
    case "plan": {
      const r = await runAi({ step: "demo_plan", tier: "cheap", system: PLAN_SYSTEM_PROMPT, userText: `${brief}\n${buildPlanConstraints(options)}`, schema: planSchema, maxTokens: 800 });
      return { state: { ...state, plan: normalizePlan(r.output, options) }, costEur: r.costEur };
    }
    case "copy_home": {
      const r = await runAi({ step: "demo_copy_home", tier: "capable", system: HOME_SYSTEM_PROMPT, userText: brief, schema: homeCopySchema, maxTokens: 4000 });
      return { state: { ...state, home: r.output }, costEur: r.costEur };
    }
    case "copy_leistungen": {
      // Basis ist eine einzige Seite: Leistungen stehen auf der Startseite, Kontakt-Überschrift ist fest. Kein Aufruf, keine Kosten.
      if (isOnePager(options.package)) return { state, costEur: 0 };
      const r = await runAi({ step: "demo_copy_leistungen", tier: "capable", system: LEISTUNGEN_SYSTEM_PROMPT, userText: brief, schema: leistungenCopySchema, maxTokens: 4000 });
      return { state: { ...state, leistungen: r.output }, costEur: r.costEur };
    }
    case "copy_features": {
      const features = state.features ?? DEFAULT_FEATURES;
      // Ohne Bausteine, die Text brauchen, gibt es keinen KI-Aufruf und keine Kosten.
      if (!needsFeatureCopy(features)) return { state: { ...state, featureCopy: null }, costEur: 0 };
      if (!state.home) throw new Error(`${FAILED} (Texte fehlen)`);
      const r = await runAi({
        step: "demo_copy_features",
        tier: "capable",
        system: FEATURES_SYSTEM_PROMPT,
        userText: buildFeaturesUserText(brief, features, state.home),
        schema: featureCopySchema,
        maxTokens: 3000,
      });
      return { state: { ...state, featureCopy: r.output }, costEur: r.costEur };
    }
    case "seo": {
      if (!state.home || (!isOnePager(options.package) && !state.leistungen)) throw new Error(`${FAILED} (Texte fehlen)`);
      const r = await runAi({
        step: "demo_seo",
        tier: "cheap",
        system: SEO_SYSTEM_PROMPT,
        userText: buildSeoUserText(brief, state.home, state.leistungen ?? null, isOnePager(options.package) ? ["/"] : ["/", "/leistungen", "/kontakt"]),
        schema: seoOutputSchema,
        maxTokens: 1200,
      });
      return { state: { ...state, seo: r.output }, costEur: r.costEur };
    }
  }
}
