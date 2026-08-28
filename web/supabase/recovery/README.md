# Återställning efter felkörd SQL i Supabase

Setup-skriptet för ett *annat* projekt — schemaläggningsverktyget med
tavlor, pass och TransPA-synk (migrationerna `0000_init` till
`0008_rotation`) — kördes av misstag mot lönsamhetskalkylens
Supabase-projekt. Katalogen innehåller det som behövs för att ta sig
tillbaka.

Kör i ordning:

1. `01_diagnostik.sql` — ändrar ingenting, visar bara vad som hände.
2. `02_aterstall.sql` — åtgärdar det.

Båda klistras in i Supabase → SQL Editor, hela filen i taget.

Supabases SQL Editor visar bara resultatet av den **sista** satsen när man
kör flera på en gång. Därför är `01_diagnostik.sql` skriven som en enda
fråga som returnerar alla sju kontroller i samma tabell, och därför slutar
`02_aterstall.sql` med en slutkontroll — dess `RAISE NOTICE`-rapport syns
inte nödvändigtvis i editorn, men den avslutande frågan gör det.

## Vad skriptet faktiskt gjorde

Hela körningen låg i en enda `BEGIN … COMMIT`. Den gick alltså antingen
igenom i sin helhet eller inte alls — det finns inget halvvägs-läge att
reda ut.

### Det som gör att appen slutar fungera

```sql
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
-- samma sak för authenticated
```

`ALL TABLES IN SCHEMA public` betyder alla tabeller i schemat — inte bara
de skriptet självt skapade. Lönsamhetskalkylens egna tabeller
(`Historical_shipment`, `User`, `messages`, `daily_equipage_forecast`,
`sunes_pricing`, `prisjusteringar` och resten) förlorade alltså sina
rättigheter för `anon` och `authenticated`.

Det spelar roll här därför att webbappen går mot Supabase med
anon-nyckeln från webbläsaren och låter RLS-policyerna avgöra vad var och
en får se. Utan tabellrättigheter kommer man aldrig så långt som till
policyerna: varje anrop faller på `permission denied for table …`.

`service_role` rördes inte, så cron-jobbet `/api/cron/daily-forecast` och
API-routes som använder service role-nyckeln har fortsatt fungera. Det är
förmodligen därför delar av systemet verkat friska.

**Ingen data raderades av det här.** Rättigheter är metadata; raderna
ligger kvar orörda.

### Det som är skräp men ofarligt

Skriptet skapade 18 främmande tabeller i `public` (`board`, `assignment`,
`employee`, `vehicle`, `session`, `app_user`, `transpa_shift` med flera),
elva enum-typer och ett `drizzle`-schema med nio migrationsrader.
Allt tomt. `02_aterstall.sql` städar bort det.

### Det som är värt att kontrollera

```sql
DROP TABLE IF EXISTS "work_pattern_day";
DROP TABLE IF EXISTS "work_pattern";
```

De två raderna är de enda i hela skriptet som kan ha förstört befintlig
data. I sitt eget sammanhang tar de bort tabeller skriptet nyss skapat,
men de är oskyddade: hade lönsamhetskalkylen haft tabeller med just de
namnen vore de borta nu.

Inget i den här kodbasen läser eller skriver `work_pattern` eller
`work_pattern_day`, så det är osannolikt. Vill du vara säker: en
`DROP TABLE` utan `CASCADE` misslyckas om någon annan tabell har en
främmande nyckel mot den, och ett fel hade rullat tillbaka hela
transaktionen. Att körningen gick igenom betyder alltså antingen att
tabellerna inte fanns, eller att de fanns utan beroenden. Är du osäker
går det att titta i en säkerhetskopia från före körningen
(Supabase → Database → Backups) och jämföra tabellistan.

## Vad återställningen inte kan veta

`02_aterstall.sql` ger tillbaka Supabases standardrättigheter i `public`.
Det är rätt läge för det här projektet — RLS är grinden, inte
tabellrättigheterna — men skulle någon rättighet ha dragits in med flit
innan misstaget så läggs den tillbaka och behöver dras in igen.

Skriptet tar bara bort en tabell som är tom **och** har exakt den
kolumnuppsättning setup-skriptet skapar, och bara en enum-typ vars värden
stämmer exakt. Allt annat lämnas orört och rapporteras i utskriften, så
att en tabell som råkade heta likadant sedan tidigare aldrig kan
försvinna på köpet.

## Så är skripten provade

Båda filerna är körda mot en riktig PostgreSQL 16 med Supabases roller
(`anon`, `authenticated`, `service_role`) och standardrättigheter
efterliknade, med några av lönsamhetskalkylens tabeller på plats och med
den felaktiga SQL:en applicerad ovanpå.

- Skadan reproducerades: efter misstagskörningen hade `anon` och
  `authenticated` noll tabellrättigheter och fick `permission denied`,
  medan `service_role` fortsatte fungera och all data låg kvar.
- Efter `02_aterstall.sql` läser både `anon` och `authenticated` igen,
  `INSERT` mot identity-kolumner fungerar, RLS-policyn på
  `daily_equipage_forecast` är orörd, och de 18 främmande tabellerna,
  elva typerna och drizzle-schemat är borta.
- Att köra `02_aterstall.sql` en andra gång ändrar ingenting.
- Slutkontrollen i `02_aterstall.sql` visar efteråt att alla tre rollerna
  har rättigheter igen, att default privileges är tillbaka, och att inget
  ligger kvar under `kvar_att_reda_ut`.
- Spärrarna provades var för sig: en tabell med andra kolumner, en tabell
  med rätt kolumner men med rader i, en enum med samma namn men andra
  värden, och ett drizzle-schema med en okänd migrationsrad — samtliga
  lämnades orörda och rapporterades i utskriften.
