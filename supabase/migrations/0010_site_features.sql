-- Milestone 4, Etappe C: gewählte Features einer Demo (docs/16-milestone-4c-feature-auswahl.md)
-- Gespeichert, damit "Neu erzeugen" die letzte Auswahl wieder vorschlägt. Der site-engine liest die Spalte nicht.

alter table sites
  add column features text[] not null default '{}',
  add constraint sites_features_known
    check (features <@ array['map', 'hours_area', 'gallery', 'pricing_team', 'booking_request']::text[]);
