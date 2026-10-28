import type { FindingCategory } from "./audit-analysis";
import type { Fact } from "./company-profile";
import type { FactorResult, ModifierResult } from "@/lib/scoring/compute";

export type Finding = { category: FindingCategory | "technical"; text: string };

export interface LeadAudit {
  id: string;
  lead_id: string;
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED";
  url: string | null;
  final_url: string | null;
  has_ssl: boolean | null;
  pagespeed_mobile_score: number | null;
  pagespeed_performance_score: number | null;
  meta_title_ok: boolean | null;
  meta_description_ok: boolean | null;
  heading_structure_ok: boolean | null;
  phone_detected: boolean | null;
  contact_form_detected: boolean | null;
  maps_embed_detected: boolean | null;
  navigation_detected: boolean | null;
  social_link_count: number | null;
  design_quality_score: number | null;
  trust_signals_notes: string | null;
  navigation_clarity_notes: string | null;
  cta_effectiveness_notes: string | null;
  local_seo_notes: string | null;
  findings: Finding[];
  warnings: string[];
  screenshot_data: string | null;
  text_excerpt: string | null;
  error_message: string | null;
  model_used: string | null;
  cost_estimate_eur: number | null;
  requested_at: string;
  completed_at: string | null;
}

export interface LeadScoreRow {
  id: string;
  lead_id: string;
  lead_audit_id: string | null;
  website_score: number;
  website_score_breakdown: { applicable: boolean; factors: FactorResult[] };
  business_potential_score: number;
  business_potential_breakdown: { factors: FactorResult[] };
  sales_opportunity_score: number;
  opportunity_breakdown: { raw: number; base: FactorResult[]; modifiers: ModifierResult[] };
  no_website_bonus_applied: boolean;
  no_contact_malus_applied: boolean;
  reachable: boolean;
  scoring_config_version: number;
  computed_at: string;
}

export interface CompanyProfileRow {
  id: string;
  lead_id: string;
  facts: Fact[];
  recommended_services: string[];
  recommended_page_structure: { slug: string; title: string; sections: string[] }[];
  recommended_ctas: string[];
  used_website_text: boolean;
  model_used: string | null;
  cost_estimate_eur: number | null;
  generated_at: string;
}

export interface ScoreSummary {
  opportunity: number;
  reachable: boolean;
}
