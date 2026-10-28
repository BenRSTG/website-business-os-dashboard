-- Milestone 3: lead_audits, lead_scores, scoring_config, company_profiles
-- (docs/03-datenmodell.md, Abweichungen siehe docs/12-milestone-3-lead-intelligence.md und DECISIONS.md)

create table lead_audits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth_org_id() references organizations (id),
  lead_id uuid not null references leads (id) on delete cascade,
  status audit_run_status not null default 'PENDING',
  url text,
  final_url text,
  -- technisch gemessen (kein KI-Aufruf)
  has_ssl boolean,
  pagespeed_mobile_score int check (pagespeed_mobile_score between 0 and 100),
  pagespeed_performance_score int check (pagespeed_performance_score between 0 and 100),
  meta_title_ok boolean,
  meta_description_ok boolean,
  heading_structure_ok boolean,
  phone_detected boolean,
  contact_form_detected boolean,
  maps_embed_detected boolean,
  navigation_detected boolean,
  social_link_count int check (social_link_count >= 0),
  -- KI-Einschätzung
  design_quality_score int check (design_quality_score between 0 and 100),
  trust_signals_notes text,
  navigation_clarity_notes text,
  cta_effectiveness_notes text,
  local_seo_notes text,
  findings jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  screenshot_data text,
  text_excerpt text,
  error_message text,
  model_used text,
  cost_estimate_eur numeric,
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

create index lead_audits_lead_idx on lead_audits (lead_id, requested_at desc);

create table scoring_config (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth_org_id() references organizations (id),
  version int not null,
  config_key text not null,
  value numeric not null default 0,
  text_value text,
  description text,
  unique (organization_id, version, config_key)
);

create table lead_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth_org_id() references organizations (id),
  lead_id uuid not null references leads (id) on delete cascade,
  lead_audit_id uuid references lead_audits (id) on delete set null,
  website_score int not null check (website_score between 0 and 100),
  website_score_breakdown jsonb not null,
  business_potential_score int not null check (business_potential_score between 0 and 100),
  business_potential_breakdown jsonb not null,
  sales_opportunity_score int not null check (sales_opportunity_score between 0 and 100),
  opportunity_breakdown jsonb not null,
  no_website_bonus_applied boolean not null default false,
  no_contact_malus_applied boolean not null default false,
  reachable boolean not null,
  scoring_config_version int not null,
  computed_at timestamptz not null default now()
);

create index lead_scores_lead_idx on lead_scores (lead_id, computed_at desc);

create table company_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth_org_id() references organizations (id),
  lead_id uuid not null references leads (id) on delete cascade,
  facts jsonb not null default '[]'::jsonb,
  recommended_services text[] not null default '{}',
  recommended_page_structure jsonb not null default '[]'::jsonb,
  recommended_ctas text[] not null default '{}',
  used_website_text boolean not null default false,
  model_used text,
  cost_estimate_eur numeric,
  generated_at timestamptz not null default now()
);

create index company_profiles_lead_idx on company_profiles (lead_id, generated_at desc);

alter table lead_audits enable row level security;
alter table scoring_config enable row level security;
alter table lead_scores enable row level security;
alter table company_profiles enable row level security;

revoke all on lead_audits, scoring_config, lead_scores, company_profiles from anon;
grant select, insert, update, delete on lead_audits, scoring_config, lead_scores, company_profiles to authenticated;

create policy "owner_full_access" on lead_audits
  for all to authenticated
  using (organization_id = (select auth_org_id()))
  with check (organization_id = (select auth_org_id()));

create policy "owner_full_access" on scoring_config
  for all to authenticated
  using (organization_id = (select auth_org_id()))
  with check (organization_id = (select auth_org_id()));

create policy "owner_full_access" on lead_scores
  for all to authenticated
  using (organization_id = (select auth_org_id()))
  with check (organization_id = (select auth_org_id()));

create policy "owner_full_access" on company_profiles
  for all to authenticated
  using (organization_id = (select auth_org_id()))
  with check (organization_id = (select auth_org_id()));
