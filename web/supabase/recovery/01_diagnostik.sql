-- Diagnostik efter att schemaskriptet för schemaläggningsverktyget
-- (0000_init … 0008_rotation, "transpa"/tavlor) av misstag kördes mot
-- lönsamhetskalkylens Supabase-projekt.
--
-- Skriptet ÄNDRAR INGENTING. Det läser bara ut vad som hände.
--
-- Allt ligger i EN enda fråga med avsikt: Supabases SQL Editor visar bara
-- resultatet av den sista satsen när man kör flera på en gång. Sju
-- separata frågor hade alltså gett sex osynliga svar.
--
-- Markera hela filen, klistra in i Supabase → SQL Editor, tryck Run.
-- Läs kolumnen "kontroll" för att se vilket avsnitt varje rad hör till.

WITH forvantad_tabell(tabell, kolumner) AS (
  VALUES
    ('absence',        ARRAY['created_at','employee_id','from_date','id','note','status','to_date','transpa_synced_at','transpa_synced_by','type','updated_at']),
    ('app_user',       ARRAY['connect_user_id','created_at','email','failed_login_count','id','is_active','last_login_at','locked_until','name','password_hash','role']),
    ('assignment',     ARRAY['board_row_id','date','employee_id','id','note','shift','slot','source','updated_at','updated_by','vehicle_id']),
    ('base_schedule',  ARRAY['board_id','board_row_id','created_at','cycle_weeks','employee_id','id','shift','sort_order','valid_from','valid_to','weekdays']),
    ('board',          ARRAY['cell_fields','created_at','cycle_length','cycle_offset','default_view_mode','id','name','owner_id','slug','sort_order','traffic_area_id','updated_at','visible_shifts','visible_weekdays','week_starts_on']),
    ('board_crew',     ARRAY['board_id','employee_id','sort_order']),
    ('board_group',    ARRAY['board_id','id','label','sort_order']),
    ('board_member',   ARRAY['board_id','role','user_id']),
    ('board_row',      ARRAY['board_id','color','created_at','default_vehicle_id','employee_id','group_id','id','kind','label','sort_order','sublabel','updated_at','valid_from','valid_to','vehicle_kind']),
    ('employee',       ARRAY['created_at','employee_number','first_name','id','is_active','last_name','profession_group','signature','station_place_id','traffic_area_id','transpa_id','transpa_tenant_id','updated_at']),
    ('session',        ARRAY['created_at','expires_at','token_hash','user_id']),
    ('station_place',  ARRAY['emergency_phone_number','id','name','supervisor_phone_number','transpa_id']),
    ('sync_run',       ARRAY['error','finished_at','id','item_count','resource','started_at','status']),
    ('traffic_area',   ARRAY['id','name','transpa_id']),
    ('transpa_shift',  ARRAY['date','direction','employee_id','ends_at','id','is_extra_shift','name','shift','starts_at','synced_at','transpa_id','work_minutes']),
    ('transpa_tenant', ARRAY['created_at','id','is_active','name','tenant_id']),
    ('vehicle',        ARRAY['created_at','display_name','external_id','id','is_active','registration_number','station_place_id','traffic_area_id','transpa_id','updated_at','vehicle_group_id']),
    ('vehicle_group',  ARRAY['id','name','transpa_id']),
    ('work_pattern',     ARRAY['anchor_date','created_at','cycle_weeks','employee_id','id','note','updated_at','valid_from','valid_to','week_starts_on']),
    ('work_pattern_day', ARRAY['cycle_week','id','shift','weekday','work_pattern_id'])
),
forvantad_typ(typnamn, varden) AS (
  VALUES
    ('absence_status',    ARRAY['requested','approved']),
    ('absence_type',      ARRAY['semester','sjuk','vab','tjanstledig','foraldraledig','kompledig','ovrig']),
    ('assignment_source', ARRAY['generated','manual']),
    ('board_role',        ARRAY['editor','viewer']),
    ('direction',         ARRAY['upp','ner']),
    ('row_kind',          ARRAY['resource','person']),
    ('shift',             ARRAY['day','night']),
    ('sync_status',       ARRAY['running','ok','failed']),
    ('user_role',         ARRAY['admin','planner']),
    ('vehicle_kind',      ARRAY['linjebil','bytesbil','annan']),
    ('view_mode',         ARRAY['resource','person'])
),
resultat AS (

  -- 1. Tabellrättigheter. Det här är den faktiska skadan: skriptets
  --    REVOKE ALL ON ALL TABLES IN SCHEMA public träffade alla tabeller i
  --    schemat, även lönsamhetskalkylens egna. Webbappen går mot Supabase
  --    med anon-nyckeln, så utan de här rättigheterna faller varje anrop
  --    på "permission denied" innan RLS-policyerna ens prövas.
  --    Friskt läge: en rad per roll, med samma antal som antalet tabeller.
  SELECT 1 AS ordning, '1. tabellrattigheter' AS kontroll, g.grantee::text AS objekt,
         count(DISTINCT g.table_name)::text || ' tabeller' AS detalj
    FROM information_schema.role_table_grants g
   WHERE g.table_schema = 'public'
     AND g.grantee IN ('anon','authenticated','service_role')
   GROUP BY g.grantee

  UNION ALL
  -- Uttrycklig rad för den roll som INTE har någonting kvar, så att ett
  -- problem syns som en rad i stället för som en rad som saknas.
  SELECT 1, '1. tabellrattigheter', r.rolname::text,
         '>>> INGA rattigheter alls i public <<<'
    FROM pg_roles r
   WHERE r.rolname IN ('anon','authenticated','service_role')
     AND NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants g
                      WHERE g.table_schema = 'public' AND g.grantee = r.rolname)

  -- 2. Sekvensrättigheter. Revoken tog även ALL SEQUENCES; utan dem
  --    misslyckas INSERT mot tabeller med löpnummer.
  UNION ALL
  SELECT 2, '2. sekvensrattigheter', g.grantee::text,
         count(DISTINCT g.object_name)::text || ' sekvenser'
    FROM information_schema.role_usage_grants g
   WHERE g.object_schema = 'public'
     AND g.grantee IN ('anon','authenticated','service_role')
   GROUP BY g.grantee

  UNION ALL
  SELECT 2, '2. sekvensrattigheter', r.rolname::text,
         '>>> INGA rattigheter alls i public <<<'
    FROM pg_roles r
   WHERE r.rolname IN ('anon','authenticated','service_role')
     AND NOT EXISTS (SELECT 1 FROM information_schema.role_usage_grants g
                      WHERE g.object_schema = 'public' AND g.grantee = r.rolname)

  -- 3. Default privileges: vad NYA tabeller ärver. Skriptet körde
  --    ALTER DEFAULT PRIVILEGES ... REVOKE ALL ON TABLES, så anon och
  --    authenticated ska saknas på raden för tabeller.
  UNION ALL
  SELECT 3, '3. default_privileges',
         CASE d.defaclobjtype WHEN 'r' THEN 'tabeller' WHEN 'S' THEN 'sekvenser'
                              WHEN 'f' THEN 'funktioner' ELSE d.defaclobjtype::text END,
         d.defaclacl::text
    FROM pg_default_acl d
    JOIN pg_namespace n ON n.oid = d.defaclnamespace
   WHERE n.nspname = 'public'

  -- 4. Vilka av schemaläggningsverktygets tabeller ligger kvar?
  --    "rader: 0 | kolumner stammer: true" = skapad av misstagskörningen,
  --    tas bort utan risk av 02_aterstall.sql.
  --    Allt annat = en tabell som fanns här sedan tidigare. Den lämnas
  --    orörd, och då vill jag se raden.
  UNION ALL
  SELECT 4, '4. frammande_tabell', f.tabell,
         'rader: ' || (xpath('/row/c/text()',
                             query_to_xml(format('SELECT count(*) AS c FROM public.%I', f.tabell),
                                          false, true, '')))[1]::text
      || ' | kolumner stammer: ' || coalesce((
             (SELECT array_agg(a.attname::text ORDER BY a.attname)
                FROM pg_attribute a
               WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped)
             = (SELECT array_agg(x ORDER BY x) FROM unnest(f.kolumner) x)
           )::text, 'okant')
      || ' | RLS: ' || c.relrowsecurity::text
    FROM forvantad_tabell f
    JOIN pg_class c ON c.relname = f.tabell
                   AND c.relkind = 'r'
                   AND c.relnamespace = 'public'::regnamespace

  -- 5. Vilka av skriptets enum-typer ligger kvar, och har de exakt
  --    skriptets värden? Skiljer värdena sig fanns typen här sedan
  --    tidigare, och då är den inte vår att ta bort.
  UNION ALL
  SELECT 5, '5. frammande_typ', f.typnamn,
         'varden: ' || coalesce((SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder)
                                   FROM pg_enum e WHERE e.enumtypid = t.oid)::text, '?')
      || ' | stammer: ' || ((SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder)
                               FROM pg_enum e WHERE e.enumtypid = t.oid) = f.varden)::text
      || ' | anvands av ' || (SELECT count(*) FROM pg_attribute a
                                JOIN pg_class c2 ON c2.oid = a.attrelid
                               WHERE a.atttypid = t.oid AND NOT a.attisdropped
                                 AND c2.relkind IN ('r','p','v','m','f'))::text || ' kolumner'
    FROM forvantad_typ f
    JOIN pg_type t ON t.typname = f.typnamn
                  AND t.typnamespace = 'public'::regnamespace

  -- 6. Tabeller med RLS påslaget men utan en enda policy. Det tillståndet
  --    gör en tabell oläsbar för anon/authenticated och är precis vad
  --    misstagskörningen orsakar. Ligger någon av LÖNSAMHETSKALKYLENS
  --    egna tabeller här är det en krock som behöver redas ut för hand.
  UNION ALL
  SELECT 6, '6. rls_utan_policy', c.relname::text,
         CASE WHEN EXISTS (SELECT 1 FROM forvantad_tabell f WHERE f.tabell = c.relname)
              THEN 'hor till det felkorda skriptet'
              ELSE '>>> EGEN TABELL — RLS pa utan policy <<<' END
    FROM pg_class c
   WHERE c.relnamespace = 'public'::regnamespace
     AND c.relkind = 'r'
     AND c.relrowsecurity
     AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid)

  -- 7. drizzle-schemat som skriptet la till. Lönsamhetskalkylen använder
  --    inte Drizzle, så det ska vara en tabell med nio rader.
  UNION ALL
  SELECT 7, '7. drizzle', coalesce(c.relname::text, '(tomt schema)'),
         coalesce((xpath('/row/c/text()',
                         query_to_xml(format('SELECT count(*) AS c FROM %I.%I', n.nspname, c.relname),
                                      false, true, '')))[1]::text, '-') || ' rader'
    FROM pg_namespace n
    LEFT JOIN pg_class c ON c.relnamespace = n.oid AND c.relkind IN ('r','p','v','m')
   WHERE n.nspname = 'drizzle'
)
SELECT kontroll, objekt, detalj
  FROM resultat
 ORDER BY ordning, objekt;
