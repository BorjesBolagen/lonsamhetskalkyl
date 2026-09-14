-- Versionshanterar de fyra BEFORE-triggarna på Historical_shipment.
--
-- De skapades direkt i Supabase-dashboarden och har aldrig funnits i repot.
-- Innehållet här är hämtat ordagrant ur "supabase db dump" och ändrar därför
-- ingenting när migrationen körs mot den befintliga databasen – allt använder
-- CREATE OR REPLACE. Syftet är att logiken ska gå att granska, återställa och
-- sätta upp i en testdatabas.
--
-- Triggarna fyller i de härledda kolumnerna som hela trappstegsmodellen
-- filtrerar och aggregerar på. Importen skriver dem aldrig själv:
--
--   weight_class      -> steg_1, steg_2, steg_3, steg_4 och dedupliceringen
--   sender_taxep      -> steg_1, steg_4, steg_5 och dedupliceringen
--   receiver_taxep    -> samma
--   forh_SE_radvis    -> steg_2, steg_3 och steg_5
--   office_relation   -> steg_5
--
-- Namnprefixen 01/02/03/zz ger körordningen, eftersom PostgreSQL kör
-- BEFORE ROW-triggers i bokstavsordning. Ordningen spelar dock ingen roll i
-- praktiken: varje funktion räknar fram sina egna indata i stället för att läsa
-- vad en tidigare trigger satt. set_forh_se_radvis anropar till exempel
-- get_taxep() och get_weight_class() på nytt i stället för att använda
-- NEW.sender_taxep och NEW.weight_class.

-- 01: postnummer -> taxepunkt för avsändare och mottagare.
create or replace function public.fill_taxepunkt() returns trigger
    language plpgsql
    as $$
BEGIN
  SELECT taxepunktspostnummer INTO NEW.sender_taxep
  FROM "tax_point_lookup"
  WHERE postnummer = NEW.sender_zip
  LIMIT 1;

  SELECT taxepunktspostnummer INTO NEW.receiver_taxep
  FROM "tax_point_lookup"
  WHERE postnummer = NEW.receiver_zip
  LIMIT 1;

  RETURN NEW;
END;
$$;

-- 02: vikt -> viktklass. Observera att vikt_till_viktklass även täcker negativa
-- vikter, och att en makulering på -28 000 kg får samma klass (28) som en
-- riktig sändning på +28 000 kg. Sådana rader sållas därför bort redan vid
-- import, se importEngine.ts och dedupliceringsfunktionen.
create or replace function public.set_weight_class_trigger() returns trigger
    language plpgsql
    as $$BEGIN
  NEW.weight_class := get_weight_class(NEW.weight);
  RETURN NEW;
END;$$;

-- 03: radens kilopris i förhållande till medel-SE för samma avstånd och
-- viktklass. Anropar get_medel_se, som läser calculation_medelse.
create or replace function public.set_forh_se_radvis() returns trigger
    language plpgsql
    as $$
DECLARE
  v_distance INT;
  v_medel FLOAT8;
BEGIN
  v_distance := get_distance(get_taxep(NEW.sender_zip), get_taxep(NEW.receiver_zip));
  v_medel := get_medel_se(v_distance, get_weight_class(NEW.weight));

  IF v_medel IS NULL OR v_medel = 0 OR NEW.weight IS NULL OR NEW.weight = 0 THEN
    NEW."forh_SE_radvis" := NULL;
    RETURN NEW;
  END IF;

  NEW."forh_SE_radvis" := (NEW.net_customer_freight / NULLIF(NEW.weight, 0)) / v_medel;
  RETURN NEW;
END;
$$;

-- zz: kontorsrelation, t.ex. "GBG-STH". Läser kontorsforkortning via
-- postnummer (primärnyckel), inte via taxepunkt.
create or replace function public.set_office_relation_historical_shipment() returns trigger
    language plpgsql
    as $$
declare
  v_sender_office text;
  v_receiver_office text;
begin
  -- Hämta kontorsförkortning via postnummer
  select tpl.kontorsforkortning
    into v_sender_office
  from public.tax_point_lookup tpl
  where tpl.postnummer = new.sender_zip
  limit 1;

  select tpl.kontorsforkortning
    into v_receiver_office
  from public.tax_point_lookup tpl
  where tpl.postnummer = new.receiver_zip
  limit 1;

  if v_sender_office <> '' and v_receiver_office <> '' then
    new.office_relation := v_sender_office || '-' || v_receiver_office;
  else
    new.office_relation := null;
  end if;

  return new;
end;
$$;

create or replace trigger "01_trg_fill_taxepunkt"
  before insert or update of sender_zip, receiver_zip
  on public."Historical_shipment"
  for each row execute function public.fill_taxepunkt();

create or replace trigger "02_trg_set_weight_class"
  before insert or update of weight
  on public."Historical_shipment"
  for each row execute function public.set_weight_class_trigger();

create or replace trigger "03_trg_set_forh_se_radvis"
  before insert or update of sender_zip, receiver_zip, weight
  on public."Historical_shipment"
  for each row execute function public.set_forh_se_radvis();

create or replace trigger "zz_set_office_relation_historical_shipment"
  before insert or update of sender_zip, receiver_zip
  on public."Historical_shipment"
  for each row execute function public.set_office_relation_historical_shipment();
