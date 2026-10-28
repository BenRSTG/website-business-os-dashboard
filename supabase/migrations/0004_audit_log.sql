-- Milestone 2 (ursprünglich für Milestone 3 geplant, siehe docs/DECISIONS.md):
-- audit_log (docs/03-datenmodell.md). Speist schon jetzt den Aktivitäts-Feed des Dashboards
-- (Lead angelegt, Status gewechselt); ab Milestone 3 protokolliert es zusätzlich alle KI-Aufrufe.
--
-- Append-only: Es gibt bewusst nur Policies für SELECT und INSERT, keine für UPDATE/DELETE.

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth_org_id() references organizations (id),
  actor audit_actor not null,
  user_id uuid references users (id),
  action_type text not null,
  entity_type text not null,
  entity_id uuid not null,
  input jsonb,
  output jsonb,
  model_used text,
  cost_estimate numeric,
  requires_approval boolean not null default false,
  approved_by uuid references users (id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create index audit_log_entity_idx on audit_log (entity_type, entity_id);
create index audit_log_org_created_idx on audit_log (organization_id, created_at desc);

alter table audit_log enable row level security;

revoke all on audit_log from anon;

create policy "owner_select" on audit_log
  for select to authenticated
  using (organization_id = (select auth_org_id()));

create policy "owner_insert" on audit_log
  for insert to authenticated
  with check (organization_id = (select auth_org_id()));
