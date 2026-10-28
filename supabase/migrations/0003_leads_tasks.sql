-- Milestone 2: leads + tasks (docs/03-datenmodell.md), RLS Muster A (docs/07-datenbankplanung.md)
--
-- organization_id hat den Default auth_org_id(): Der eingeloggte Owner muss die Organisation
-- nie selbst mitschicken, und die RLS-Policy verhindert, dass er eine fremde setzt.

create or replace function set_updated_at() returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth_org_id() references organizations (id),
  company_name text not null,
  industry lead_industry not null default 'sonstiges',
  contact_name text,
  phone text,
  email text,
  address_street text,
  address_zip text,
  address_city text,
  existing_website_url text,
  google_profile_url text,
  google_rating numeric(2, 1) check (google_rating between 0 and 5),
  google_rating_count int check (google_rating_count >= 0),
  status lead_status not null default 'NEW',
  source lead_source not null default 'manual',
  next_contact_at timestamptz,
  notes text,
  reactivated_at timestamptz,
  reactivation_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger leads_set_updated_at
  before update on leads
  for each row execute function set_updated_at();

create index leads_org_status_idx on leads (organization_id, status);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth_org_id() references organizations (id),
  lead_id uuid references leads (id) on delete cascade,
  -- Fremdschlüssel auf customers folgt in Migration 0007 (Milestone 6).
  customer_id uuid,
  due_at timestamptz,
  contact_type task_contact_type not null,
  status task_status not null default 'OPEN',
  result task_result,
  note text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint tasks_exactly_one_parent check (num_nonnulls(lead_id, customer_id) = 1)
);

create index tasks_lead_id_idx on tasks (lead_id);
create index tasks_org_due_open_idx on tasks (organization_id, due_at) where status = 'OPEN';

alter table leads enable row level security;
alter table tasks enable row level security;

revoke all on leads, tasks from anon;

create policy "owner_full_access" on leads
  for all to authenticated
  using (organization_id = (select auth_org_id()))
  with check (organization_id = (select auth_org_id()));

create policy "owner_full_access" on tasks
  for all to authenticated
  using (organization_id = (select auth_org_id()))
  with check (organization_id = (select auth_org_id()));
