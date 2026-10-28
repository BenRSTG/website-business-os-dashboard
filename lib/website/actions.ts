"use server";

import { requireUser, type Supabase } from "@/lib/auth";
import { getAiConfig, resolveModel } from "@/lib/ai/config";
import { runAiStep } from "@/lib/ai/run-step";
import { AiBudgetError, AiConfigError, AiProviderError, AiRefusalError, AiValidationError } from "@/lib/ai/types";
import { getLatestProfile } from "@/lib/intelligence/queries";
import { logLeadEvent, refreshLeadViews } from "@/lib/leads/events";
import { leadIdSchema } from "@/lib/leads/schemas";
import { getLead } from "@/lib/leads/queries";
import type { Lead } from "@/lib/leads/types";
import { z } from "zod";
import { STEPS, nextStep, type StepId } from "./steps";
import {
  assemble,
  assertDemoBudget,
  executeAiStep,
  type RunAi,
  type RunState,
} from "./pipeline";
import { previewSlug } from "./slug";
import type { AssembleResult } from "./pipeline";

const STALE_RUN_MINUTES = 30;

export type DemoStepResult = {
  error: string | null;
  runId?: string;
  /** nächster auszuführender Schritt, null wenn der Lauf fertig ist */
  step?: StepId | null;
  done?: boolean;
};

const fail = (message: string): DemoStepResult => ({ error: message });
const isStep = (value: string): value is StepId => (STEPS as readonly string[]).includes(value);

function userMessage(error: unknown): string {
  if (
    error instanceof AiConfigError ||
    error instanceof AiBudgetError ||
    error instanceof AiProviderError ||
    error instanceof AiRefusalError
  ) {
    return error.message;
  }
  if (error instanceof AiValidationError) {
    return `Die KI lieferte zweimal keine verwertbare Antwort (${error.message}). Bitte den Schritt erneut versuchen.`;
  }
  console.error("Unerwarteter Fehler bei der Demo-Erstellung:", error);
  return "Unerwarteter Fehler. Bitte erneut versuchen.";
}

export async function startDemoRun(leadId: string): Promise<DemoStepResult> {
  const { supabase } = await requireUser();
  if (!leadIdSchema.safeParse(leadId).success) return fail("Ungültiger Lead.");
  const lead = await getLead(leadId);
  if (!lead) return fail("Lead nicht gefunden.");

  try {
    getAiConfig(); // meldet fehlende Einrichtung sofort, nicht erst im ersten Schritt
    const profile = await getLatestProfile(lead.id);
    if (!profile) return fail("Bitte zuerst das Unternehmensprofil erstellen. Die Demo baut auf dessen Fakten auf.");

    // Läuft für diesen Lead schon ein frischer Lauf, wird er fortgesetzt statt ein zweiter (Kosten!) gestartet.
    const staleBefore = new Date(Date.now() - STALE_RUN_MINUTES * 60_000).toISOString();
    const { data: running } = await supabase
      .from("site_generation_runs")
      .select("id, current_step")
      .eq("lead_id", lead.id)
      .eq("status", "RUNNING")
      .gte("updated_at", staleBefore)
      .order("created_at", { ascending: false })
      .limit(1);
    if (running && running.length > 0 && isStep(running[0].current_step)) {
      return { error: null, runId: running[0].id, step: running[0].current_step };
    }

    const { data: created, error } = await supabase
      .from("site_generation_runs")
      .insert({ lead_id: lead.id, current_step: STEPS[0] })
      .select("id")
      .single();
    if (error) return fail("Der Lauf konnte nicht gestartet werden.");
    return { error: null, runId: created.id, step: STEPS[0] };
  } catch (error) {
    return fail(userMessage(error));
  }
}

async function failRun(supabase: Supabase, runId: string, message: string, terminal: boolean, report?: unknown, costEur?: number) {
  await supabase
    .from("site_generation_runs")
    .update({ error_message: message, ...(terminal ? { status: "FAILED" } : {}), ...(report ? { quality_report: report } : {}), ...(costEur !== undefined ? { cost_total_eur: costEur } : {}) })
    .eq("id", runId);
}

export async function advanceDemoRun(runId: string, expectedStep: string): Promise<DemoStepResult> {
  const { supabase, userId } = await requireUser();
  if (!z.uuid().safeParse(runId).success) return fail("Ungültiger Lauf.");

  const { data: run } = await supabase
    .from("site_generation_runs")
    .select("id, lead_id, status, current_step, state, cost_total_eur")
    .eq("id", runId)
    .maybeSingle();
  if (!run) return fail("Lauf nicht gefunden.");
  if (run.status !== "RUNNING") return fail("Dieser Lauf ist bereits beendet.");
  // Schutz vor Doppelklick und parallelen Tabs: nur der erwartete Schritt darf (und nur einmal) ausgeführt werden.
  if (run.current_step !== expectedStep || !isStep(run.current_step)) {
    return { error: null, runId, step: isStep(run.current_step) ? run.current_step : null };
  }
  const step: StepId = run.current_step;

  const lead = await getLead(run.lead_id);
  const profile = lead ? await getLatestProfile(lead.id) : null;
  if (!lead || !profile) return fail("Lead oder Unternehmensprofil nicht mehr vorhanden.");

  let spent = Number(run.cost_total_eur);
  try {
    const config = getAiConfig();
    let state = run.state as RunState;

    if (step === "assemble") {
      const result = assemble(lead, profile, state);
      if (result.report.errors.length > 0) {
        const message = `Die Qualitätsprüfung hat Fehler gefunden: ${result.report.errors.slice(0, 3).join("; ")}`;
        await failRun(supabase, runId, message, true, result.report);
        return fail(message);
      }
      const siteId = await saveDemoSite(supabase, lead, result, spent);
      await supabase
        .from("site_generation_runs")
        .update({ status: "DONE", site_id: siteId, quality_report: result.report, error_message: null })
        .eq("id", runId);
      await logLeadEvent(supabase, userId, "lead.demo_created", lead.id, { company_name: lead.company_name, cost_eur: spent });
      refreshLeadViews();
      return { error: null, runId, step: null, done: true };
    }

    const runAi: RunAi = async (args) => {
      const model = resolveModel(args.tier, config);
      assertDemoBudget({
        spentEur: spent,
        maxDemoEur: config.maxCostPerDemoEur,
        model,
        textChars: args.system.length + args.userText.length,
        maxTokens: args.maxTokens,
        usdEurRate: config.usdEurRate,
      });
      try {
        const result = await runAiStep({
          supabase,
          userId,
          step: args.step,
          entityType: "lead",
          entityId: lead.id,
          tier: args.tier,
          system: args.system,
          userText: args.userText,
          schema: args.schema,
          maxTokens: args.maxTokens,
        });
        spent += result.costEur;
        return { output: result.output, costEur: result.costEur };
      } catch (error) {
        spent += Number((error as { costEur?: number }).costEur ?? 0);
        throw error;
      }
    };

    const out = await executeAiStep(step, { lead, profile, state, runAi });
    state = out.state;
    const following = nextStep(step);
    await supabase
      .from("site_generation_runs")
      .update({ state, cost_total_eur: spent, current_step: following ?? step, error_message: null })
      .eq("id", runId)
      .eq("current_step", step);
    return { error: null, runId, step: following, done: false };
  } catch (error) {
    const message = userMessage(error);
    // Budget-Überschreitung beendet den Lauf; bei vorübergehenden KI-Fehlern bleibt er fortsetzbar.
    await failRun(supabase, runId, message, error instanceof AiBudgetError, undefined, spent);
    return fail(message);
  }
}

async function saveDemoSite(supabase: Supabase, lead: Lead, result: AssembleResult, costEur: number): Promise<string> {
  let site: { id: string } | null = null;
  for (let attempt = 0; attempt < 3 && !site; attempt++) {
    const { data, error } = await supabase
      .from("sites")
      .insert({
        lead_id: lead.id,
        company_name: lead.company_name,
        style: result.style,
        status: "PREVIEW",
        preview_slug: previewSlug(lead.company_name),
        primary_phone: lead.phone,
        primary_cta_label: lead.phone ? "Jetzt anrufen" : "Anfrage senden",
        generation_cost_estimate: costEur,
      })
      .select("id")
      .single();
    if (data) site = data;
    else if (error && error.code !== "23505") throw new Error(`Website konnte nicht angelegt werden: ${error.message}`);
  }
  if (!site) throw new Error("Es konnte keine freie Vorschau-Adresse erzeugt werden.");

  try {
    const { error: tokenError } = await supabase.from("design_tokens").insert({ site_id: site.id, ...result.tokens });
    if (tokenError) throw new Error(`Design konnte nicht gespeichert werden: ${tokenError.message}`);
    const { error: pageError } = await supabase.from("site_pages").insert(
      result.pages.map((p) => ({ site_id: site!.id, slug: p.slug, page_type: p.page_type, sections: p.sections, seo: p.seo })),
    );
    if (pageError) throw new Error(`Seiten konnten nicht gespeichert werden: ${pageError.message}`);
  } catch (error) {
    await supabase.from("sites").delete().eq("id", site.id); // halbfertige Website nicht stehen lassen
    throw error;
  }

  // Frühere, vom System erzeugte Demos desselben Leads werden erst jetzt ersetzt. Von Hand angelegte Sites bleiben.
  const { data: earlier } = await supabase
    .from("site_generation_runs")
    .select("site_id")
    .eq("lead_id", lead.id)
    .not("site_id", "is", null)
    .neq("site_id", site.id);
  const oldIds = (earlier ?? []).map((r) => r.site_id as string);
  if (oldIds.length > 0) await supabase.from("sites").delete().in("id", oldIds).eq("status", "PREVIEW");

  return site.id;
}
