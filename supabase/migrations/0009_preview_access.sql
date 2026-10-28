-- Milestone 5A: Passwortschutz der Vorschau (docs/15-milestone-5-preview-zugang.md)
-- Der öffentliche Schlüssel darf den Passwort-Hash nie lesen (Spaltenrechte aus 0007). Deshalb prüft eine Funktion
-- das Passwort und liefert nur ja/nein; Fehlversuche werden hier gezählt, damit auch ein direkter Aufruf über die
-- Schnittstelle gedrosselt ist.

-- Zeitstempel der letzten Passwortänderung: macht ältere Freischalt-Cookies ungültig. Öffentlich lesbar (kein Geheimnis).
alter table sites add column preview_password_set_at timestamptz;
grant select (preview_password_set_at) on sites to anon;

create table preview_attempts (
  id bigint generated always as identity primary key,
  site_id uuid not null references sites (id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index preview_attempts_site_idx on preview_attempts (site_id, attempted_at desc);

-- Nur über die Funktionen erreichbar, nie direkt.
alter table preview_attempts enable row level security;
revoke all on preview_attempts from anon, authenticated;

create or replace function preview_password_ok(p_slug text, p_password text) returns boolean
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_hash text;
begin
  if p_slug is null or p_password is null or length(p_password) > 200 then
    return false;
  end if;

  select s.id, s.preview_password_hash into v_id, v_hash
  from sites s
  where s.preview_slug = p_slug
    and s.status = 'PREVIEW'
    and (s.preview_expires_at is null or s.preview_expires_at > now());
  if v_id is null or v_hash is null then
    return false;
  end if;

  -- Drosselung: ab 10 Fehlversuchen in 15 Minuten wird nicht mehr geprüft.
  if (select count(*) from preview_attempts a
      where a.site_id = v_id and a.attempted_at > now() - interval '15 minutes') >= 10 then
    return false;
  end if;

  if crypt(p_password, v_hash) = v_hash then
    return true;
  end if;

  insert into preview_attempts (site_id) values (v_id);
  -- alte Einträge beiläufig aufräumen
  delete from preview_attempts where attempted_at < now() - interval '1 day';
  return false;
end
$$;

create or replace function set_preview_password(p_site uuid, p_password text) returns void
language plpgsql security definer set search_path = public, extensions
as $$
begin
  if not exists (select 1 from sites where id = p_site and organization_id = auth_org_id()) then
    raise exception 'Website nicht gefunden' using errcode = '42501';
  end if;
  if p_password is null or length(p_password) < 8 or length(p_password) > 200 then
    raise exception 'Das Passwort muss mindestens 8 Zeichen haben';
  end if;
  update sites
    set preview_password_hash = crypt(p_password, gen_salt('bf', 10)),
        preview_password_set_at = now()
    where id = p_site;
  delete from preview_attempts where site_id = p_site;
end
$$;

create or replace function clear_preview_password(p_site uuid) returns void
language plpgsql security definer set search_path = public, extensions
as $$
begin
  if not exists (select 1 from sites where id = p_site and organization_id = auth_org_id()) then
    raise exception 'Website nicht gefunden' using errcode = '42501';
  end if;
  update sites set preview_password_hash = null, preview_password_set_at = now() where id = p_site;
end
$$;

revoke execute on function preview_password_ok(text, text) from public;
revoke execute on function set_preview_password(uuid, text) from public;
revoke execute on function clear_preview_password(uuid) from public;
-- Supabase vergibt neue Funktionen standardmäßig auch an anon: für die Owner-Funktionen ausdrücklich entziehen.
revoke execute on function set_preview_password(uuid, text) from anon;
revoke execute on function clear_preview_password(uuid) from anon;
grant execute on function preview_password_ok(text, text) to anon, authenticated;
grant execute on function set_preview_password(uuid, text) to authenticated;
grant execute on function clear_preview_password(uuid) to authenticated;
