import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { QualityReport } from "./quality";
import { STEPS } from "./steps";

export interface GenerationRun {
  id: string;
  lead_id: string;
  status: "RUNNING" | "DONE" | "FAILED";
  current_step: string;
  cost_total_eur: number;
  error_message: string | null;
  quality_report: QualityReport | null;
  site_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DemoSite {
  id: string;
  preview_slug: string | null;
  style: "modern" | "traditional" | "premium";
  status: string;
  preview_expires_at: string | null;
  preview_protected: boolean;
  created_at: string;
}

export async function getLatestRun(leadId: string): Promise<GenerationRun | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_generation_runs")
    .select("id, lead_id, status, current_step, cost_total_eur, error_message, quality_report, site_id, created_at, updated_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Demo-Lauf konnte nicht geladen werden: ${error.message}`);
  return data as GenerationRun | null;
}

export async function getDemoSites(leadId: string): Promise<DemoSite[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sites")
    .select("id, preview_slug, style, status, preview_expires_at, preview_protected, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Demos konnten nicht geladen werden: ${error.message}`);
  return data as DemoSite[];
}

const DEFAULT_ENGINE_URL = "https://website-business-os-site-engine.vercel.app";

/** Vorschau-Link auf den site-engine (Pfad-Fallback /preview/<slug>, solange keine Vorschau-Domain eingerichtet ist). */
export function previewUrl(slug: string): string {
  const base = (process.env.SITE_ENGINE_URL || DEFAULT_ENGINE_URL).replace(/\/+$/, "");
  return `${base}/preview/${slug}`;
}

const RESUMABLE_MINUTES = 30;

/** Ein laufender Lauf, der in den letzten 30 Minuten aktiv war, kann fortgesetzt werden. */
export function isResumable(run: GenerationRun | null): boolean {
  return (
    run?.status === "RUNNING" &&
    (STEPS as readonly string[]).includes(run.current_step) &&
    Date.now() - new Date(run.updated_at).getTime() < RESUMABLE_MINUTES * 60_000
  );
}

export function isExpired(expiresAt: string | null): boolean {
  return expiresAt !== null && Date.parse(expiresAt) <= Date.now();
}
