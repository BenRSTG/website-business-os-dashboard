-- Beispieldaten (rein fiktiv: erfundene Betriebe, Personen und Nummern). Kein Migrationsschritt.
--
-- Einmalig im Supabase SQL Editor ausführen, NACHDEM Migration 0003 und 0004 eingespielt
-- und der Owner angelegt wurde (bootstrap-owner.sql). Bricht ab, wenn schon Leads existieren.

do $$
declare
  v_org uuid;
  v_weber uuid;
  v_nowak uuid;
  v_schmidt uuid;
  v_fischer uuid;
  v_vogt uuid;
begin
  select id into v_org from organizations order by created_at limit 1;
  if v_org is null then
    raise exception 'Keine Organisation gefunden. Zuerst bootstrap-owner.sql ausführen.';
  end if;
  if exists (select 1 from leads where organization_id = v_org) then
    raise exception 'Es existieren bereits Leads — Seed wird nicht erneut ausgeführt.';
  end if;

  insert into leads (organization_id, company_name, industry, contact_name, phone, email,
                     address_street, address_zip, address_city, existing_website_url,
                     google_rating, google_rating_count, status, source, notes, created_at)
  values
    (v_org, 'Elektro Weber', 'elektro', 'Herr Weber', '07821 555 0101', 'info@elektro-weber.example.com',
     'Hauptstraße 12', '77933', 'Lahr', 'https://elektro-weber.example.com',
     4.6, 87, 'DEMO_CREATED', 'google_ads',
     'Kam über die Landingpage „Kostenloser Website-Check“. Bestehende Seite von 2016, nicht mobiloptimiert.',
     now() - interval '9 days')
  returning id into v_weber;

  insert into leads (organization_id, company_name, industry, contact_name, phone, email,
                     address_street, address_zip, address_city, existing_website_url,
                     google_rating, google_rating_count, status, source, created_at)
  values
    (v_org, 'Dachdecker Nowak', 'dachdecker', 'Herr Nowak', '0781 555 0102', 'kontakt@dach-nowak.example.com',
     'Gewerbering 4', '77652', 'Offenburg', null,
     4.8, 134, 'MEETING', 'cold_call', now() - interval '14 days')
  returning id into v_nowak;

  insert into leads (organization_id, company_name, industry, contact_name, phone, email,
                     address_city, existing_website_url, google_rating, google_rating_count,
                     status, source, created_at)
  values
    (v_org, 'Gartenbau Schmidt', 'garten_landschaft', 'Frau Schmidt', '07641 555 0103', 'post@gartenbau-schmidt.example.com',
     'Emmendingen', 'https://gartenbau-schmidt.example.com', 4.4, 52, 'PROPOSAL', 'referral', now() - interval '21 days')
  returning id into v_schmidt;

  insert into leads (organization_id, company_name, industry, contact_name, phone, email,
                     address_city, status, source, created_at)
  values
    (v_org, 'SHK Fischer GmbH', 'shk', 'Herr Fischer', '0761 555 0104', 'info@shk-fischer.example.com',
     'Freiburg', 'NEW', 'manual', now() - interval '1 day')
  returning id into v_fischer;

  insert into leads (organization_id, company_name, industry, contact_name, phone,
                     address_city, google_rating, google_rating_count, status, source, created_at)
  values
    (v_org, 'Malerwerkstatt Keller', 'maler', 'Herr Keller', '07644 555 0105',
     'Kenzingen', 4.2, 31, 'QUALIFIED', 'manual', now() - interval '4 days'),
    (v_org, 'Dach & Fassade Krause', 'dachdecker', 'Herr Krause', '07681 555 0106',
     'Waldkirch', 3.9, 18, 'CONTACTED', 'cold_call', now() - interval '12 days'),
    (v_org, 'Bau Reinhardt', 'sonstiges', 'Frau Reinhardt', '0761 555 0107',
     'Freiburg', 4.1, 64, 'INTERESTED', 'referral', now() - interval '8 days');

  insert into leads (organization_id, company_name, industry, contact_name, phone,
                     address_city, status, source, created_at)
  values
    (v_org, 'Grün & Handwerk Vogt', 'garten_landschaft', 'Herr Vogt', '07666 555 0108',
     'Denzlingen', 'LOST', 'cold_call', now() - interval '30 days')
  returning id into v_vogt;

  -- Aufgaben: zwei fällig heute/überfällig, eine für später, dazu protokollierte Anrufe.
  insert into tasks (organization_id, lead_id, contact_type, status, due_at, note) values
    (v_org, v_nowak,   'CALL',  'OPEN', now() - interval '1 hour',  'Rückruf vereinbart'),
    (v_org, v_schmidt, 'EMAIL', 'OPEN', now(),                      'Angebot nachfassen'),
    (v_org, v_weber,   'DEMO',  'OPEN', now() + interval '3 days',  'Demo-Link versenden');

  insert into tasks (organization_id, lead_id, contact_type, status, result, note, completed_at, created_at) values
    (v_org, v_weber, 'CALL', 'DONE', 'REACHED', 'Interessiert, wünscht eine Demo.', now() - interval '5 days', now() - interval '5 days'),
    (v_org, v_nowak, 'CALL', 'DONE', 'CALLBACK_SCHEDULED', 'Termin vor Ort besprochen.', now() - interval '3 days', now() - interval '3 days'),
    (v_org, v_vogt,  'CALL', 'DONE', 'NOT_INTERESTED', 'Hat bereits eine Agentur.', now() - interval '20 days', now() - interval '20 days');

  update leads set next_contact_at = now() - interval '1 hour' where id = v_nowak;
  update leads set next_contact_at = now() where id = v_schmidt;
  update leads set next_contact_at = now() + interval '3 days' where id = v_weber;

  insert into audit_log (organization_id, actor, action_type, entity_type, entity_id, input, created_at) values
    (v_org, 'USER', 'lead.created',        'lead', v_fischer, '{"company_name": "SHK Fischer GmbH"}', now() - interval '1 day'),
    (v_org, 'USER', 'lead.status_changed', 'lead', v_nowak,   '{"company_name": "Dachdecker Nowak", "from": "CONTACTED", "to": "MEETING"}', now() - interval '3 days'),
    (v_org, 'USER', 'lead.status_changed', 'lead', v_weber,   '{"company_name": "Elektro Weber", "from": "QUALIFIED", "to": "DEMO_CREATED"}', now() - interval '2 days');
end $$;

-- Kontrolle: acht Leads
select status, count(*) from leads group by status order by status;
