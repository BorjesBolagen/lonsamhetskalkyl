-- Återställning efter att schemaläggningsverktygets setup-skript
-- (0000_init … 0008_rotation) av misstag kördes mot lönsamhetskalkylens
-- Supabase-projekt.
--
-- Kör 01_diagnostik.sql FÖRST och läs resultatet. Kör sedan den här
-- filen i sin helhet i Supabase → SQL Editor.
--
-- Skriptet gör tre saker, i den ordningen:
--   1. Tar bort de främmande tabellerna — men bara de som är tomma OCH
--      har exakt den kolumnuppsättning skriptet skapar. Allt annat lämnas
--      orört och rapporteras i utskriften.
--   2. Tar bort de främmande enum-typerna och drizzle-schemat, med samma
--      slags spärrar.
--   3. Ger tillbaka anon och authenticated de rättigheter i public som
--      REVOKE-blocket tog. Det här är steget som gör webbappen körbar igen.
--
-- Ordningen spelar roll: tabellerna tas bort innan rättigheterna ges
-- tillbaka, annars skulle de främmande tabellerna publiceras i
-- Supabases data-API på vägen.
--
-- Skriptet går att köra om. Det som redan är åtgärdat hoppas över.

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Främmande tabeller
-- ---------------------------------------------------------------------
DO $do$
DECLARE
  r            record;
  faktiska     text[];
  antal_rader  bigint;
  borttagna    text[] := '{}';
  behallna     text[] := '{}';
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('absence',        ARRAY['created_at','employee_id','from_date','id','note','status','to_date','transpa_synced_at','transpa_synced_by','type','updated_at']),
      ('assignment',     ARRAY['board_row_id','date','employee_id','id','note','shift','slot','source','updated_at','updated_by','vehicle_id']),
      ('base_schedule',  ARRAY['board_id','board_row_id','created_at','cycle_weeks','employee_id','id','shift','sort_order','valid_from','valid_to','weekdays']),
      ('board_crew',     ARRAY['board_id','employee_id','sort_order']),
      ('board_member',   ARRAY['board_id','role','user_id']),
      ('board_row',      ARRAY['board_id','color','created_at','default_vehicle_id','employee_id','group_id','id','kind','label','sort_order','sublabel','updated_at','valid_from','valid_to','vehicle_kind']),
      ('board_group',    ARRAY['board_id','id','label','sort_order']),
      ('board',          ARRAY['cell_fields','created_at','cycle_length','cycle_offset','default_view_mode','id','name','owner_id','slug','sort_order','traffic_area_id','updated_at','visible_shifts','visible_weekdays','week_starts_on']),
      ('transpa_shift',  ARRAY['date','direction','employee_id','ends_at','id','is_extra_shift','name','shift','starts_at','synced_at','transpa_id','work_minutes']),
      ('work_pattern_day', ARRAY['cycle_week','id','shift','weekday','work_pattern_id']),
      ('work_pattern',   ARRAY['anchor_date','created_at','cycle_weeks','employee_id','id','note','updated_at','valid_from','valid_to','week_starts_on']),
      ('employee',       ARRAY['created_at','employee_number','first_name','id','is_active','last_name','profession_group','signature','station_place_id','traffic_area_id','transpa_id','transpa_tenant_id','updated_at']),
      ('transpa_tenant', ARRAY['created_at','id','is_active','name','tenant_id']),
      ('session',        ARRAY['created_at','expires_at','token_hash','user_id']),
      ('app_user',       ARRAY['connect_user_id','created_at','email','failed_login_count','id','is_active','last_login_at','locked_until','name','password_hash','role']),
      ('vehicle',        ARRAY['created_at','display_name','external_id','id','is_active','registration_number','station_place_id','traffic_area_id','transpa_id','updated_at','vehicle_group_id']),
      ('vehicle_group',  ARRAY['id','name','transpa_id']),
      ('station_place',  ARRAY['emergency_phone_number','id','name','supervisor_phone_number','transpa_id']),
      ('traffic_area',   ARRAY['id','name','transpa_id']),
      ('sync_run',       ARRAY['error','finished_at','id','item_count','resource','started_at','status'])
    ) AS v(tabell, kolumner)
  LOOP
    -- Finns tabellen alls?
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      WHERE c.relname = r.tabell
        AND c.relkind = 'r'
        AND c.relnamespace = 'public'::regnamespace
    ) THEN
      CONTINUE;
    END IF;

    -- Spärr 1: kolumnuppsättningen måste vara exakt skriptets. Skiljer
    -- den sig är det en tabell som fanns här sedan tidigare.
    SELECT array_agg(a.attname::text ORDER BY a.attname)
      INTO faktiska
      FROM pg_attribute a
     WHERE a.attrelid = format('public.%I', r.tabell)::regclass
       AND a.attnum > 0
       AND NOT a.attisdropped;

    IF faktiska IS DISTINCT FROM (SELECT array_agg(x ORDER BY x) FROM unnest(r.kolumner) x) THEN
      behallna := behallna || format('%s (andra kolumner än skriptets — rörs ej)', r.tabell);
      CONTINUE;
    END IF;

    -- Spärr 2: tabellen måste vara tom. Misstagskörningen hann aldrig
    -- lägga in någon rad; finns rader är det någon annans data.
    EXECUTE format('SELECT count(*) FROM public.%I', r.tabell) INTO antal_rader;
    IF antal_rader > 0 THEN
      behallna := behallna || format('%s (%s rader — rörs ej)', r.tabell, antal_rader);
      CONTINUE;
    END IF;

    EXECUTE format('DROP TABLE public.%I CASCADE', r.tabell);
    borttagna := borttagna || r.tabell;
  END LOOP;

  RAISE NOTICE 'Borttagna tabeller (%): %', coalesce(array_length(borttagna, 1), 0), borttagna;
  RAISE NOTICE 'Behållna tabeller (%): %', coalesce(array_length(behallna, 1), 0), behallna;
END
$do$;

-- ---------------------------------------------------------------------
-- 2a. Främmande enum-typer
-- ---------------------------------------------------------------------
DO $do$
DECLARE
  r         record;
  varden    text[];
  borttagna text[] := '{}';
  behallna  text[] := '{}';
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
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
    ) AS v(typnamn, varden)
  LOOP
    SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder)
      INTO varden
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
     WHERE t.typname = r.typnamn
       AND t.typnamespace = 'public'::regnamespace;

    IF varden IS NULL THEN
      CONTINUE;  -- typen finns inte
    END IF;

    -- Spärr: värdena måste vara exakt skriptets. Fanns en typ med samma
    -- namn här sedan tidigare hoppade skriptet över den, och då är den
    -- inte vår att ta bort.
    IF varden IS DISTINCT FROM r.varden THEN
      behallna := behallna || format('%s (andra värden än skriptets — rörs ej)', r.typnamn);
      CONTINUE;
    END IF;

    -- Inget CASCADE: finns en kolumn kvar som använder typen ska DROP
    -- misslyckas, inte dra med sig kolumnen.
    BEGIN
      EXECUTE format('DROP TYPE public.%I', r.typnamn);
      borttagna := borttagna || r.typnamn;
    EXCEPTION WHEN dependent_objects_still_exist THEN
      behallna := behallna || format('%s (används av något som finns kvar — rörs ej)', r.typnamn);
    END;
  END LOOP;

  RAISE NOTICE 'Borttagna typer (%): %', coalesce(array_length(borttagna, 1), 0), borttagna;
  RAISE NOTICE 'Behållna typer (%): %', coalesce(array_length(behallna, 1), 0), behallna;
END
$do$;

-- ---------------------------------------------------------------------
-- 2b. drizzle-schemat
-- ---------------------------------------------------------------------
DO $do$
DECLARE
  kanda_hashar text[] := ARRAY[
    'dcd5e93674f810457deb29590251f149eefcf063f76dcadaff83beeec8b6cee6',
    '630566f1c775d7cab27a27d2f34809d526f59edc848077f6b812b4f881b20934',
    'f4da4f11a725385615862e445dc258a6ea655516dbbe074d071ee95b74ce6e07',
    'e9763d9ebc8edf8b80d54a3d2f65281e4bbed7a6df90043d08c74e7d06c15097',
    '561712ebc5d19e753753246dfcc89deef1ec5103edaff0b8055ba62fa9b9828f',
    'd399d11c6a7ba6bdd27c948f3fe72ce1341146b12210b581920e3001ad429e40',
    '347e303d73a62497984afc90077045204a7f86f4180f42394bea2ccadd3110e8',
    'ec4bfd13f9d121540fcbac335e5bf33ced0e7b1df380826312815f2011c1638c',
    '3bf0923e349d0a6744ce92950400d1d2477770df82bbba48c5e69ec366934a00'
  ];
  antal_objekt int;
  antal_frammande bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'drizzle') THEN
    RETURN;
  END IF;

  SELECT count(*) INTO antal_objekt
    FROM pg_class c
   WHERE c.relnamespace = 'drizzle'::regnamespace
     AND c.relkind IN ('r','p','v','m');

  IF antal_objekt <> 1
     OR NOT EXISTS (
       SELECT 1 FROM pg_class c
        WHERE c.relnamespace = 'drizzle'::regnamespace
          AND c.relname = '__drizzle_migrations')
  THEN
    RAISE NOTICE 'Schemat drizzle innehåller mer än den förväntade migrationstabellen — rörs ej.';
    RETURN;
  END IF;

  -- Spärr: bara de nio hashar misstagskörningen la in får finnas. Skulle
  -- projektet mot förmodan använda Drizzle på riktigt vore raderna andra.
  EXECUTE format(
    'SELECT count(*) FROM drizzle.%I WHERE hash <> ALL(%L::text[])',
    '__drizzle_migrations', kanda_hashar
  ) INTO antal_frammande;

  IF antal_frammande > 0 THEN
    RAISE NOTICE 'drizzle.__drizzle_migrations innehåller % okända rader — rörs ej.', antal_frammande;
    RETURN;
  END IF;

  DROP SCHEMA drizzle CASCADE;
  RAISE NOTICE 'Schemat drizzle borttaget.';
END
$do$;

-- ---------------------------------------------------------------------
-- 3. Rättigheterna tillbaka till anon och authenticated
-- ---------------------------------------------------------------------
-- Det här återställer Supabases normalläge för schemat public: rollerna
-- har rättigheter på tabellerna, och RLS är det som faktiskt avgör vad
-- var och en får se. Lönsamhetskalkylen är byggd på precis det — appen
-- går mot Supabase med anon-nyckeln och lutar sig mot policyerna.
--
-- OBS: det här ger tillbaka Supabases standarduppsättning. Hade någon
-- rättighet dragits in med flit i det här projektet innan misstaget,
-- läggs den tillbaka här och behöver dras in igen.
-- Bara det som revoken faktiskt tog ges tillbaka. Funktionsrättigheter
-- rördes aldrig av misstagskörningen och lämnas därför ifred.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES    IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Och för tabeller som skapas härefter — det var den raden
-- ALTER DEFAULT PRIVILEGES ... REVOKE ALL ON TABLES tog bort.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;

COMMIT;

-- PostgREST cachar schemat. Utan den här signalen kan API:t fortsätta
-- svara utifrån den gamla bilden en stund.
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- Slutkontroll
-- ---------------------------------------------------------------------
-- Skriptet rapporterar vad det gjorde med RAISE NOTICE, och Supabases SQL
-- Editor visar inte alltid sådana meddelanden — den visar frågeresultat,
-- och bara från den sista satsen. Därför den här avslutande frågan: den
-- blir det du faktiskt får se.
--
-- Så här ska det se ut när allt gått igenom:
--   tabellrattigheter   anon / authenticated / service_role, samma antal
--   default_privileges  raden för "tabeller" nämner alla tre rollerna
--   kvar_att_reda_ut    inga rader alls
SELECT kontroll, objekt, detalj FROM (

  SELECT 1 AS ordning, 'tabellrattigheter' AS kontroll, g.grantee::text AS objekt,
         count(DISTINCT g.table_name)::text || ' tabeller' AS detalj
    FROM information_schema.role_table_grants g
   WHERE g.table_schema = 'public'
     AND g.grantee IN ('anon','authenticated','service_role')
   GROUP BY g.grantee

  UNION ALL
  SELECT 1, 'tabellrattigheter', r.rolname::text, '>>> SAKNAR RATTIGHETER <<<'
    FROM pg_roles r
   WHERE r.rolname IN ('anon','authenticated','service_role')
     AND NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants g
                      WHERE g.table_schema = 'public' AND g.grantee = r.rolname)

  UNION ALL
  SELECT 2, 'default_privileges',
         CASE d.defaclobjtype WHEN 'r' THEN 'tabeller' WHEN 'S' THEN 'sekvenser'
                              WHEN 'f' THEN 'funktioner' ELSE d.defaclobjtype::text END,
         d.defaclacl::text
    FROM pg_default_acl d
    JOIN pg_namespace n ON n.oid = d.defaclnamespace
   WHERE n.nspname = 'public'

  -- Det som spärrarna valde att inte röra. Tomt = allt är städat.
  UNION ALL
  SELECT 3, 'kvar_att_reda_ut', c.relname::text, 'tabell som skriptet lamnade orord'
    FROM pg_class c
   WHERE c.relnamespace = 'public'::regnamespace
     AND c.relkind = 'r'
     AND c.relname IN ('absence','app_user','assignment','base_schedule','board','board_crew',
                       'board_group','board_member','board_row','employee','session',
                       'station_place','sync_run','traffic_area','transpa_shift',
                       'transpa_tenant','vehicle','vehicle_group','work_pattern','work_pattern_day')

  UNION ALL
  SELECT 3, 'kvar_att_reda_ut', t.typname::text, 'enum-typ som skriptet lamnade orord'
    FROM pg_type t
   WHERE t.typnamespace = 'public'::regnamespace
     AND t.typtype = 'e'
     AND t.typname IN ('absence_status','absence_type','assignment_source','board_role','direction',
                       'row_kind','shift','sync_status','user_role','vehicle_kind','view_mode')

  UNION ALL
  SELECT 3, 'kvar_att_reda_ut', 'drizzle', 'schemat finns kvar'
    FROM pg_namespace n WHERE n.nspname = 'drizzle'

) AS slutkontroll
ORDER BY ordning, kontroll, objekt;
