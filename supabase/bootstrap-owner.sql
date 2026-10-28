-- EINMALIG im Supabase SQL Editor ausführen (kein Migrationsschritt).
--
-- Voraussetzung:
--   1. Migrationen 0001 und 0002 sind eingespielt.
--   2. Der Login-Account existiert bereits:
--      Supabase Dashboard > Authentication > Users > "Add user" > "Create new user"
--      (E-Mail + Passwort, "Auto Confirm User" aktivieren).
--
-- Ersetze DEINE@EMAIL.DE unten durch genau diese E-Mail-Adresse.

with new_org as (
  insert into organizations (name)
  values ('Website Business OS')
  returning id
)
insert into users (id, organization_id, role, display_name)
select au.id, new_org.id, 'owner', 'Owner'
from auth.users au, new_org
where au.email = 'DEINE@EMAIL.DE';

-- Kontrolle: sollte genau eine Zeile liefern.
select u.id, u.role, o.name as organization
from users u join organizations o on o.id = u.organization_id;
