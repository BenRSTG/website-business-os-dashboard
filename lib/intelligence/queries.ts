import "server-only";
import { createClient } from "@/lib/supabase/server";
import { buildConfig, DEFAULT_CONFIG_ROWS, type ScoringConfig } from "@/lib/scoring/config";
import type { Supabase } from "@/lib/auth";
import type { CompanyProfileRow, LeadAudit, LeadScoreRow, ScoreSummary } from "./types";

function fail(what: string, message: string): never {
  throw new Error(`${what}: ${message}`);
}

export async function getLatestAudit(leadId: string): Promise<LeadAudit | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lead_audits")
    .select("*")
    .eq("lead_id", leadId)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) fail("Audit konnte nicht geladen werden", error.message);
  return data as LeadAudit | null;
}

export async function getLatestScores(leadId: string): Promise<LeadScoreRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lead_scores")
    .select("*")
    .eq("lead_id", leadId)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) fail("Scores konnten nicht geladen werden", error.message);
  return data as LeadScoreRow | null;
}

export async function getLatestProfile(leadId: string): Promise<CompanyProfileRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_profiles")
    .select("*")
    .eq("lead_id", leadId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) fail("Profil konnte nicht geladen werden", error.message);
  return data as CompanyProfileRow | null;
}

/** Neuester Opportunity-Score je Lead — für Liste und Pipeline. */
export async function getScoreSummaries(): Promise<Map<string, ScoreSummary>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lead_scores")
    .select("lead_id, sales_opportunity_score, reachable, computed_at")
    .order("computed_at", { ascending: false });
  if (error) fail("Scores konnten nicht geladen werden", error.message);

  const map = new Map<string, ScoreSummary>();
  for (const row of data as { lead_id: string; sales_opportunity_score: number; reachable: boolean }[]) {
    if (!map.has(row.lead_id)) {
      map.set(row.lead_id, { opportunity: row.sales_opportunity_score, reachable: row.reachable });
    }
  }
  return map;
}

/** Schwellen für die Badge-Darstellung; ohne gespeicherte Konfiguration gelten die Standardwerte. */
export async function getScoringConfig(): Promise<ScoringConfig> {
  const supabase = await createClient();
  return (await loadScoringConfig(supabase, { seedIfMissing: false })).config;
}

/**
 * Lädt die neueste Konfigurationsversion. Fehlt sie (z. B. frisch eingerichtetes Projekt),
 * wird Version 1 mit den Standardwerten angelegt — so sind Scores von Anfang an nachvollziehbar.
 */
export async function loadScoringConfig(
  supabase: Supabase,
  options: { seedIfMissing: boolean } = { seedIfMissing: true },
): Promise<{ config: ScoringConfig; version: number }> {
  const { data, error } = await supabase
    .from("scoring_config")
    .select("version, config_key, value, text_value")
    .order("version", { ascending: false });
  if (error) fail("Konfiguration konnte nicht geladen werden", error.message);

  const rows = (data ?? []) as { version: number; config_key: string; value: number | string; text_value: string | null }[];
  if (rows.length === 0) {
    if (options.seedIfMissing) {
      const { error: seedError } = await supabase.from("scoring_config").insert(
        DEFAULT_CONFIG_ROWS.map((row) => ({
          version: 1,
          config_key: row.key,
          value: row.value,
          text_value: row.textValue ?? null,
          description: row.description,
        })),
      );
      if (seedError) console.error("Standard-Konfiguration konnte nicht gespeichert werden:", seedError.message);
    }
    return { config: buildConfig(), version: 1 };
  }

  const latest = rows[0].version;
  return { config: buildConfig(rows.filter((r) => r.version === latest)), version: latest };
}
