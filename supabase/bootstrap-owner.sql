-- EINMALIG im Supabase SQL Editor ausführen (kein Migrationsschritt).
--
-- Voraussetzung:
--   1. Migrationen 0001 und 0002 sind eingespielt.
--   2. Der Login-Account existiert bereits:
--      Supabase Dashboard > Authentication > Users > "Add user" > "Create new user"
--      (E-Mail + Passwort, "Auto Confirm User" aktivieren).
--
-- Ersetze DEINE@EMAIL.DE unten durch genau diese E-Mail-Adresse.
-- Das Skript bricht mit einer Fehlermeldung ab, wenn kein Auth-User gefunden wird,
-- und lässt sich gefahrlos wiederholen (legt nichts doppelt an).

do $$
declare
  v_email constant text := 'DEINE@EMAIL.DE';
  v_user uuid;
  v_org uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(v_email);
  if v_user is null then
    raise exception 'Kein Auth-User mit der E-Mail % gefunden. Authentication > Users prüfen.', v_email;
  end if;

  select id into v_org from organizations order by created_at limit 1;
  if v_org is null then
    insert into organizations (name) values ('Website Business OS') returning id into v_org;
  end if;

  insert into users (id, organization_id, role, display_name)
  values (v_user, v_org, 'owner', 'Owner')
  on conflict (id) do nothing;
end $$;

-- Kontrolle: sollte genau eine Zeile liefern.
select u.id, u.role, o.name as organization
from users u join organizations o on o.id = u.organization_id;
