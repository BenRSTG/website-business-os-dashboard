-- Milestone 0: organizations + users, RLS-Grundmuster (docs/07-datenbankplanung.md, Muster A)

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid not null references organizations (id),
  role user_role not null default 'owner',
  display_name text,
  created_at timestamptz not null default now()
);

create index users_organization_id_idx on users (organization_id);

alter table organizations enable row level security;
alter table users enable row level security;

-- Kein anon-Zugriff auf diese Tabellen, in keiner Form.
revoke all on organizations, users from anon;

-- Helper für alle owner-only-Policies späterer Migrationen.
-- Bewusst "security invoker": liest users unter den Rechten des Aufrufers (RLS gilt).
create or replace function auth_org_id() returns uuid
language sql stable
as $$
  select organization_id from public.users where id = (select auth.uid())
$$;

-- users: jede Person sieht nur ihre eigene Zeile.
-- (Nicht auth_org_id() verwenden — würde die Policy rekursiv auf sich selbst verweisen.)
create policy "users_select_own" on users
  for select to authenticated
  using (id = (select auth.uid()));

-- organizations: nur die eigene Organisation.
create policy "organizations_select_own" on organizations
  for select to authenticated
  using (id = auth_org_id());
