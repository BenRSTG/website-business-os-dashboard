-- Milestone 4 (Etappe B): Läufe der Website-Generierung (docs/14-milestone-4b-ki-pipeline.md)
-- Ein Lauf wird vom Browser in einzelnen Schritten fortgesetzt; hier steht der Zwischenstand,
-- damit nichts an Zeitlimits hängt und ein unterbrochener Lauf weitergeführt werden kann.

create type generation_run_status as enum ('RUNNING', 'DONE', 'FAILED');

create table site_generation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth_org_id() references organizations (id),
  lead_id uuid not null references leads (id) on delete cascade,
  status generation_run_status not null default 'RUNNING',
  current_step text not null,
  state jsonb not null default '{}'::jsonb,
  cost_total_eur numeric not null default 0,
  error_message text,
  quality_report jsonb,
  site_id uuid references sites (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger site_generation_runs_set_updated_at
  before update on site_generation_runs
  for each row execute function set_updated_at();

create index site_generation_runs_lead_idx on site_generation_runs (lead_id, created_at desc);

alter table site_generation_runs enable row level security;

-- Nur der Owner; anon hat keinen Zugriff.
revoke all on site_generation_runs from anon;
grant select, insert, update, delete on site_generation_runs to authenticated;

create policy "owner_full_access" on site_generation_runs
  for all to authenticated
  using (organization_id = (select auth_org_id()))
  with check (
    organization_id = (select auth_org_id())
    -- der Lead muss zur eigenen Organisation gehören (sonst ließen sich Läufe an fremde Leads hängen)
    and exists (select 1 from leads l where l.id = lead_id and l.organization_id = (select auth_org_id()))
  );
