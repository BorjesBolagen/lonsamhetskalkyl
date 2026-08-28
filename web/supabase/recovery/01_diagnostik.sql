-- Diagnostik efter att schemaskriptet för schemaläggningsverktyget
-- (0000_init … 0008_rotation, "transpa"/tavlor) av misstag kördes mot
-- lönsamhetskalkylens Supabase-projekt.
--
-- Skriptet nedan ÄNDRAR INGENTING. Det läser bara ut vad som hände, så
-- att 02_aterstall.sql kan köras med vetskap om läget.
--
-- Kör hela filen i Supabase → SQL Editor och spara resultatet.

-- 1) Rättigheterna för anon och authenticated i public.
--
--    Det här är den faktiska skadan. Skriptet körde
--      REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated
--    vilket träffar ALLA tabeller i public — även lönsamhetskalkylens.
--    Webbappen går mot Supabase med anon-nyckeln och förlitar sig på RLS,
--    så utan de här rättigheterna svarar varje anrop "permission denied".
--
--    Förväntat i ett friskt Supabase-projekt: en rad per roll, med ett
--    antal som motsvarar antalet tabeller i public.
--    Tomt resultat = rättigheterna är borta.
SELECT 'tabellrättigheter' AS kontroll,
       grantee AS roll,
       count(DISTINCT table_name) AS antal_tabeller,
       array_agg(DISTINCT privilege_type ORDER BY privilege_type) AS rattigheter
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated', 'service_role')
GROUP BY grantee
ORDER BY grantee;

-- 2) Rättigheter på sekvenser (identity-/serial-kolumner).
--    Revoken tog även ALL SEQUENCES. Utan dessa misslyckas INSERT mot
--    tabeller med löpnummer.
SELECT 'sekvensrattigheter' AS kontroll,
       grantee AS roll,
       count(DISTINCT object_name) AS antal_sekvenser
FROM information_schema.role_usage_grants
WHERE object_schema = 'public'
  AND grantee IN ('anon', 'authenticated', 'service_role')
GROUP BY grantee
ORDER BY grantee;

-- 3) Default privileges — rättigheter som NYA tabeller ärver.
--    Skriptet körde ALTER DEFAULT PRIVILEGES ... REVOKE ALL ON TABLES,
--    så framtida tabeller skapade av postgres får inga rättigheter alls.
--    Förväntat: rader som ger anon/authenticated/service_role rättigheter.
SELECT 'default_privileges' AS kontroll,
       pg_get_userbyid(d.defaclrole) AS agare,
       n.nspname AS schema,
       CASE d.defaclobjtype
         WHEN 'r' THEN 'tabeller' WHEN 'S' THEN 'sekvenser'
         WHEN 'f' THEN 'funktioner' ELSE d.defaclobjtype::text END AS objekttyp,
       d.defaclacl::text AS rattigheter
FROM pg_default_acl d
JOIN pg_namespace n ON n.oid = d.defaclnamespace
WHERE n.nspname = 'public'
ORDER BY agare, objekttyp;

-- 4) Vilka av schemaläggningsverktygets tabeller ligger kvar i public,
--    hur många rader har de, och stämmer kolumnuppsättningen exakt med
--    vad skriptet skapar?
--
--    stammer = true och rader = 0 betyder: tabellen är skapad av
--    misstagskörningen och kan tas bort utan risk.
--    stammer = false eller rader > 0 betyder: rör den INTE — då är det
--    en tabell som fanns i lönsamhetskalkylen sedan tidigare och som
--    skriptet i så fall har ändrat (se punkt 6).
WITH forvantat(tabell, kolumner) AS (
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
)
SELECT 'frammande_tabell' AS kontroll,
       f.tabell,
       c.relrowsecurity AS rls_pa,
       (xpath('/row/c/text()',
              query_to_xml(format('SELECT count(*) AS c FROM public.%I', f.tabell),
                           false, true, '')))[1]::text::bigint AS rader,
       (SELECT array_agg(a.attname::text ORDER BY a.attname)
          FROM pg_attribute a
         WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped)
         = (SELECT array_agg(x ORDER BY x) FROM unnest(f.kolumner) x) AS kolumner_stammer
FROM forvantat f
LEFT JOIN pg_class c
       ON c.relname = f.tabell
      AND c.relkind = 'r'
      AND c.relnamespace = 'public'::regnamespace
WHERE c.oid IS NOT NULL
ORDER BY f.tabell;

-- 5) Vilka av skriptets enum-typer ligger kvar, och har de exakt de
--    värden skriptet skapar? (Om en typ med samma namn fanns sedan
--    tidigare hoppade skriptet över den — då ska den inte tas bort.)
WITH forvantat(typnamn, varden) AS (
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
)
SELECT 'frammande_typ' AS kontroll,
       f.typnamn,
       (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder)
          FROM pg_enum e WHERE e.enumtypid = t.oid) AS varden_i_db,
       (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder)
          FROM pg_enum e WHERE e.enumtypid = t.oid) = f.varden AS varden_stammer,
       (SELECT count(*) FROM pg_attribute a
          JOIN pg_class c2 ON c2.oid = a.attrelid
         WHERE a.atttypid = t.oid AND NOT a.attisdropped
           AND c2.relkind IN ('r','p','v','m','f')) AS antal_kolumner_som_anvander
FROM forvantat f
JOIN pg_type t ON t.typname = f.typnamn AND t.typnamespace = 'public'::regnamespace
ORDER BY f.typnamn;

-- 6) Kollision? Fanns någon av tabellerna ovan i lönsamhetskalkylen
--    sedan tidigare fick den RLS påslaget (= appen ser den som tom) och,
--    om den hette "employee", en unik-constraint borttagen och kolumner
--    tillagda. Den här listan visar tabeller i public som har RLS på men
--    ingen enda policy — det tillståndet gör en tabell oläsbar för
--    anon/authenticated och är precis vad misstagskörningen orsakar.
SELECT 'rls_utan_policy' AS kontroll,
       c.relname AS tabell,
       (xpath('/row/c/text()',
              query_to_xml(format('SELECT count(*) AS c FROM public.%I', c.relname),
                           false, true, '')))[1]::text::bigint AS rader
FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relkind = 'r'
  AND c.relrowsecurity
  AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid)
ORDER BY c.relname;

-- 7) drizzle-schemat som skriptet la till. Lönsamhetskalkylen använder
--    inte Drizzle (inget beroende i web/package.json), så det här ska
--    normalt vara ett schema med en enda tabell och nio rader.
SELECT 'drizzle' AS kontroll,
       n.nspname AS schema,
       c.relname AS tabell,
       (xpath('/row/c/text()',
              query_to_xml(format('SELECT count(*) AS c FROM %I.%I', n.nspname, c.relname),
                           false, true, '')))[1]::text::bigint AS rader
FROM pg_namespace n
LEFT JOIN pg_class c ON c.relnamespace = n.oid AND c.relkind IN ('r','p','v','m')
WHERE n.nspname = 'drizzle';
