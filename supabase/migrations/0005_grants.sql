-- Ausdrückliche Tabellenrechte für die eingeloggte Rolle "authenticated".
--
-- Supabase vergibt auf neue Tabellen im Schema public nicht in jedem Projekt automatisch Rechte.
-- Ohne GRANT scheitert jede Abfrage der App mit "permission denied", auch wenn die RLS-Policies stimmen.
-- Wirkt idempotent: Sind die Rechte schon vorhanden, ändert der Befehl nichts.
-- Die Zeilen-Sicherheit bleibt unverändert bei RLS; anon bekommt weiterhin nichts.

grant usage on schema public to authenticated;

grant select on organizations, users to authenticated;
grant select, insert, update, delete on leads, tasks to authenticated;
grant select, insert on audit_log to authenticated;
