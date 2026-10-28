-- Milestone 4 (Etappe A): sites, site_pages, design_tokens
-- RLS Muster B (docs/07-datenbankplanung.md): der anon key des site-engine liest nur LIVE-Sites und nicht
-- abgelaufene PREVIEW-Sites. Zusätzlich gelten SPALTENRECHTE: anon darf z. B. den Passwort-Hash der Vorschau,
-- die Organisation, den Lead-Bezug und die KI-Kosten nie sehen.
-- Die customer_id-Fremdschlüssel (customers existiert erst ab Milestone 6) folgt dort.

create table sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default auth_org_id() references organizations (id),
  lead_id uuid references leads (id) on delete cascade,
  customer_id uuid,
  origin_demo_site_id uuid references sites (id) on delete set null,
  company_name text not null,
  package site_package not null default 'BUSINESS',
  style site_style not null default 'modern',
  status site_status not null default 'DRAFT',
  preview_slug text unique check (preview_slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'),
  preview_password_hash text,
  preview_protected boolean generated always as (preview_password_hash is not null) stored,
  preview_expires_at timestamptz,
  custom_domain text unique,
  domain_status domain_status not null default 'NONE',
  primary_phone text,
  primary_cta_label text not null default 'Jetzt anrufen',
  generation_cost_estimate numeric,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  constraint sites_exactly_one_parent check (num_nonnulls(lead_id, customer_id) = 1)
);

create index sites_lead_idx on sites (lead_id);

create table site_pages (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites (id) on delete cascade,
  slug text not null check (slug ~ '^/([a-z0-9-]+(/[a-z0-9-]+)*)?$'),
  page_type page_type not null default 'custom',
  sections jsonb not null default '[]'::jsonb,
  seo jsonb not null default '{}'::jsonb,
  legal_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, slug)
);

create trigger site_pages_set_updated_at
  before update on site_pages
  for each row execute function set_updated_at();

create index site_pages_site_idx on site_pages (site_id);

create table design_tokens (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null unique references sites (id) on delete cascade,
  palette_id text not null,
  primary_color text not null check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  accent_color text not null check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  background_color text not null check (background_color ~ '^#[0-9a-fA-F]{6}$'),
  surface_color text not null check (surface_color ~ '^#[0-9a-fA-F]{6}$'),
  text_color text not null check (text_color ~ '^#[0-9a-fA-F]{6}$'),
  muted_color text not null check (muted_color ~ '^#[0-9a-fA-F]{6}$'),
  border_color text not null check (border_color ~ '^#[0-9a-fA-F]{6}$'),
  font_headline text not null check (font_headline in ('archivo', 'plex-sans', 'source-serif', 'fraunces')),
  font_body text not null check (font_body in ('archivo', 'plex-sans', 'source-serif', 'fraunces')),
  radius text not null check (radius in ('0px', '4px', '8px', '12px', '16px')),
  shadow_style text not null check (shadow_style in ('none', 'soft', 'sharp')),
  button_style text not null check (button_style in ('solid-round', 'solid-square', 'outline-square')),
  spacing_scale text not null default 'normal' check (spacing_scale in ('compact', 'normal', 'airy'))
);

alter table sites enable row level security;
alter table site_pages enable row level security;
alter table design_tokens enable row level security;

-- Owner: voller Zugriff innerhalb der eigenen Organisation.
revoke all on sites, site_pages, design_tokens from anon;
grant select, insert, update, delete on sites, site_pages, design_tokens to authenticated;

create policy "owner_full_access" on sites
  for all to authenticated
  using (organization_id = (select auth_org_id()))
  with check (organization_id = (select auth_org_id()));

create policy "owner_full_access" on site_pages
  for all to authenticated
  using (exists (select 1 from sites s where s.id = site_pages.site_id and s.organization_id = (select auth_org_id())))
  with check (exists (select 1 from sites s where s.id = site_pages.site_id and s.organization_id = (select auth_org_id())));

create policy "owner_full_access" on design_tokens
  for all to authenticated
  using (exists (select 1 from sites s where s.id = design_tokens.site_id and s.organization_id = (select auth_org_id())))
  with check (exists (select 1 from sites s where s.id = design_tokens.site_id and s.organization_id = (select auth_org_id())));

-- Öffentlich sichtbar: LIVE, oder PREVIEW solange nicht abgelaufen. Der Passwortschutz selbst wird im
-- site-engine geprüft (SQL kennt das Klartext-Passwort nicht); preview_protected zeigt nur, DASS eines gesetzt ist.
create or replace function site_is_public(p_site uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from sites s
    where s.id = p_site
      and (s.status = 'LIVE'
           or (s.status = 'PREVIEW' and (s.preview_expires_at is null or s.preview_expires_at > now())))
  )
$$;

grant execute on function site_is_public(uuid) to anon, authenticated;

create policy "public_read_live_or_valid_preview" on sites
  for select to anon
  using (
    status = 'LIVE'
    or (status = 'PREVIEW' and (preview_expires_at is null or preview_expires_at > now()))
  );

create policy "public_read_via_site" on site_pages
  for select to anon
  using (site_is_public(site_id));

create policy "public_read_via_site" on design_tokens
  for select to anon
  using (site_is_public(site_id));

-- Spaltenrechte für anon: bewusst ohne preview_password_hash, organization_id, lead_id, customer_id,
-- origin_demo_site_id und generation_cost_estimate.
grant select (
  id, company_name, package, style, status, preview_slug, preview_protected, preview_expires_at,
  custom_domain, domain_status, primary_phone, primary_cta_label, published_at
) on sites to anon;

grant select on site_pages, design_tokens to anon;
