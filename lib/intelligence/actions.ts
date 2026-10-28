"use server";

import { requireUser, type Supabase } from "@/lib/auth";
import { fetchPageSpeed, PageSpeedError, type PageSpeedResult } from "@/lib/audit/pagespeed";
import { parseWebsite, type HtmlChecks } from "@/lib/audit/html-parse";
import { AuditFetchError, safeFetchHtml } from "@/lib/audit/safe-fetch";
import { runAiStep } from "@/lib/ai/run-step";
import {
  AiBudgetError,
  AiConfigError,
  AiProviderError,
  AiRefusalError,
  AiValidationError,
  type AiImage,
} from "@/lib/ai/types";
import type { ActionState } from "@/lib/leads/actions";
import { logLeadEvent, refreshLeadViews } from "@/lib/leads/events";
import { leadIdSchema } from "@/lib/leads/schemas";
import { getLead } from "@/lib/leads/queries";
import type { Lead } from "@/lib/leads/types";
import { computeScores, type ScoreAuditInput, type ScoreLeadInput } from "@/lib/scoring/compute";
import type { ScoringConfig } from "@/lib/scoring/config";
import {
  AUDIT_SYSTEM_PROMPT,
  auditAnalysisSchema,
  buildAuditUserText,
  type AuditAnalysis,
} from "./audit-analysis";
import {
  PROFILE_SYSTEM_PROMPT,
  buildProfileUserText,
  companyProfileSchema,
  enforceFactRules,
} from "./company-profile";
import { technicalFindings } from "./findings";
import { getLatestAudit, loadScoringConfig } from "./queries";

const STALE_RUN_MINUTES = 10;

const fail = (message: string): ActionState => ({ error: message });

function userMessage(error: unknown): string {
  if (
    error instanceof AuditFetchError ||
    error instanceof PageSpeedError ||
    error instanceof AiConfigError ||
    error instanceof AiBudgetError ||
    error instanceof AiProviderError ||
    error instanceof AiRefusalError
  ) {
    return error.message;
  }
  if (error instanceof AiValidationError) {
    return "Die KI lieferte zweimal keine verwertbare Antwort. Bitte später erneut versuchen.";
  }
  console.error("Unerwarteter Fehler in der Lead-Analyse:", error);
  return "Unerwarteter Fehler. Bitte erneut versuchen.";
}

function toScoreLead(lead: Lead): ScoreLeadInput {
  return {
    website_url: lead.existing_website_url,
    phone: lead.phone,
    email: lead.email,
    google_rating: lead.google_rating,
    google_rating_count: lead.google_rating_count,
    industry: lead.industry,
    address_zip: lead.address_zip,
  };
}

function parseDataUri(uri: string | null | undefined): AiImage | null {
  const match = uri ? /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(uri) : null;
  return match ? { mediaType: match[1] as AiImage["mediaType"], base64: match[2] } : null;
}

async function saveScores(
  supabase: Supabase,
  lead: Lead,
  auditId: string | null,
  audit: ScoreAuditInput | null,
  config: ScoringConfig,
  version: number,
) {
  const result = computeScores(toScoreLead(lead), audit, config);
  const { error } = await supabase.from("lead_scores").insert({
    lead_id: lead.id,
    lead_audit_id: auditId,
    website_score: result.website.score,
    website_score_breakdown: { applicable: result.website.applicable, factors: result.website.factors },
    business_potential_score: result.business.score,
    business_potential_breakdown: { factors: result.business.factors },
    sales_opportunity_score: result.opportunity.score,
    opportunity_breakdown: {
      raw: result.opportunity.raw,
      base: result.opportunity.base,
      modifiers: result.opportunity.modifiers,
    },
    no_website_bonus_applied: result.noWebsiteBonusApplied,
    no_contact_malus_applied: result.noContactMalusApplied,
    reachable: result.reachable,
    scoring_config_version: version,
  });
  if (error) throw new Error(`Scores konnten nicht gespeichert werden: ${error.message}`);
  return result;
}

export async function runWebsiteAnalysis(leadId: string): Promise<ActionState> {
  const { supabase, userId } = await requireUser();
  if (!leadIdSchema.safeParse(leadId).success) return fail("Ungültiger Lead.");
  const lead = await getLead(leadId);
  if (!lead) return fail("Lead nicht gefunden.");

  try {
    const { config, version } = await loadScoringConfig(supabase);

    // Ohne Website gibt es nichts zu prüfen: Website-Score ist 0, der Bonus greift (docs/12).
    if (!lead.existing_website_url) {
      const scores = await saveScores(supabase, lead, null, null, config, version);
      await logLeadEvent(supabase, userId, "lead.scored", lead.id, {
        company_name: lead.company_name,
        opportunity: scores.opportunity.score,
      });
      refreshLeadViews();
      return { error: null, ok: true };
    }

    return await analyzeWebsite(supabase, userId, lead, config, version, lead.existing_website_url);
  } catch (error) {
    return fail(userMessage(error));
  }
}

async function analyzeWebsite(
  supabase: Supabase,
  userId: string,
  lead: Lead,
  config: ScoringConfig,
  version: number,
  url: string,
): Promise<ActionState> {
  const staleBefore = new Date(Date.now() - STALE_RUN_MINUTES * 60_000).toISOString();
  const { data: running } = await supabase
    .from("lead_audits")
    .select("id")
    .eq("lead_id", lead.id)
    .eq("status", "RUNNING")
    .gte("requested_at", staleBefore)
    .limit(1);
  if (running && running.length > 0) return fail("Für diesen Lead läuft bereits eine Analyse.");

  const { data: created, error: createError } = await supabase
    .from("lead_audits")
    .insert({ lead_id: lead.id, status: "RUNNING", url })
    .select("id")
    .single();
  if (createError) return fail("Die Analyse konnte nicht gestartet werden.");
  const auditId: string = created.id;

  try {
    const [page, speed] = await Promise.allSettled([
      safeFetchHtml(url),
      fetchPageSpeed(url, process.env.PAGESPEED_API_KEY || undefined),
    ]);

    const warnings: string[] = [];
    let checks: HtmlChecks | null = null;
    let finalUrl: string | null = null;
    let pageSpeed: PageSpeedResult | null = null;

    if (page.status === "fulfilled") {
      checks = parseWebsite(page.value.html, page.value.finalUrl);
      finalUrl = page.value.finalUrl;
      if (page.value.truncated) warnings.push("Die Seite war sehr groß und wurde nur teilweise geprüft.");
    } else {
      warnings.push(`Die Seite konnte nicht abgerufen werden: ${userMessage(page.reason)}`);
    }
    if (speed.status === "fulfilled") pageSpeed = speed.value;
    else warnings.push(`PageSpeed: ${userMessage(speed.reason)}`);

    if (!checks && !pageSpeed) {
      throw new AuditFetchError(
        "Die Website ist nicht erreichbar und PageSpeed lieferte nichts. Bitte die Adresse prüfen.",
      );
    }

    // Die KI-Einschätzung ergänzt die Messung, ersetzt sie nicht: Fällt sie aus, bleibt der Audit mit Hinweis erhalten.
    let analysis: AuditAnalysis | null = null;
    let aiCost: number | null = null;
    let aiModel: string | null = null;
    if (checks || pageSpeed?.screenshotDataUri) {
      try {
        const image = parseDataUri(pageSpeed?.screenshotDataUri);
        const result = await runAiStep({
          supabase,
          userId,
          step: "website_audit",
          entityType: "lead",
          entityId: lead.id,
          tier: "capable",
          system: AUDIT_SYSTEM_PROMPT,
          userText: buildAuditUserText({
            companyName: lead.company_name,
            industry: lead.industry,
            city: lead.address_city,
            checks,
            hasScreenshot: image !== null,
          }),
          images: image ? [image] : [],
          schema: auditAnalysisSchema,
          maxTokens: 3000,
        });
        analysis = result.output;
        aiCost = result.costEur;
        aiModel = result.model;
      } catch (error) {
        warnings.push(`KI-Einschätzung nicht möglich: ${userMessage(error)}`);
      }
    }

    const measured = {
      final_url: finalUrl,
      has_ssl: checks?.hasSsl ?? null,
      pagespeed_mobile_score: pageSpeed?.mobileScore ?? null,
      pagespeed_performance_score: pageSpeed?.performanceScore ?? null,
      meta_title_ok: checks?.metaTitleOk ?? null,
      meta_description_ok: checks?.metaDescriptionOk ?? null,
      heading_structure_ok: checks?.headingStructureOk ?? null,
      phone_detected: checks?.phoneDetected ?? null,
      contact_form_detected: checks?.contactFormDetected ?? null,
      maps_embed_detected: checks?.mapsEmbedDetected ?? null,
      navigation_detected: checks?.navigationDetected ?? null,
      social_link_count: checks?.socialLinkCount ?? null,
      design_quality_score: analysis?.design_quality_score ?? null,
    };

    const { error: updateError } = await supabase
      .from("lead_audits")
      .update({
        ...measured,
        status: "DONE",
        trust_signals_notes: analysis?.trust_signals_notes ?? null,
        navigation_clarity_notes: analysis?.navigation_clarity_notes ?? null,
        cta_effectiveness_notes: analysis?.cta_effectiveness_notes ?? null,
        local_seo_notes: analysis?.local_seo_notes ?? null,
        findings: [...technicalFindings(checks, pageSpeed), ...(analysis?.findings ?? [])],
        warnings,
        screenshot_data: pageSpeed?.screenshotDataUri ?? null,
        text_excerpt: checks?.textExcerpt ?? null,
        model_used: aiModel,
        cost_estimate_eur: aiCost,
        completed_at: new Date().toISOString(),
      })
      .eq("id", auditId);
    if (updateError) throw new Error(`Audit konnte nicht gespeichert werden: ${updateError.message}`);

    const scores = await saveScores(supabase, lead, auditId, measured, config, version);
    await logLeadEvent(supabase, userId, "lead.analyzed", lead.id, {
      company_name: lead.company_name,
      website_score: scores.website.score,
      opportunity: scores.opportunity.score,
    });
    refreshLeadViews();
    return { error: null, ok: true };
  } catch (error) {
    const message = userMessage(error);
    await supabase
      .from("lead_audits")
      .update({ status: "FAILED", error_message: message, completed_at: new Date().toISOString() })
      .eq("id", auditId);
    refreshLeadViews();
    return fail(message);
  }
}

export async function runCompanyProfile(leadId: string): Promise<ActionState> {
  const { supabase, userId } = await requireUser();
  if (!leadIdSchema.safeParse(leadId).success) return fail("Ungültiger Lead.");
  const lead = await getLead(leadId);
  if (!lead) return fail("Lead nicht gefunden.");

  try {
    const audit = await getLatestAudit(lead.id);
    const websiteText = audit?.status === "DONE" && audit.text_excerpt ? audit.text_excerpt : null;

    const result = await runAiStep({
      supabase,
      userId,
      step: "company_profile",
      entityType: "lead",
      entityId: lead.id,
      tier: "capable",
      system: PROFILE_SYSTEM_PROMPT,
      userText: buildProfileUserText(lead, websiteText),
      schema: companyProfileSchema,
      maxTokens: 4000,
    });

    const { facts } = enforceFactRules(result.output.facts, { hasWebsiteText: websiteText !== null });
    const { error } = await supabase.from("company_profiles").insert({
      lead_id: lead.id,
      facts,
      recommended_services: result.output.recommended_services.slice(0, 8),
      recommended_page_structure: result.output.recommended_page_structure,
      recommended_ctas: result.output.recommended_ctas.slice(0, 4),
      used_website_text: websiteText !== null,
      model_used: result.model,
      cost_estimate_eur: result.costEur,
    });
    if (error) throw new Error(`Profil konnte nicht gespeichert werden: ${error.message}`);

    await logLeadEvent(supabase, userId, "lead.profiled", lead.id, { company_name: lead.company_name });
    refreshLeadViews();
    return { error: null, ok: true };
  } catch (error) {
    return fail(userMessage(error));
  }
}
