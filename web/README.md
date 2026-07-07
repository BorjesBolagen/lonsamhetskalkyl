# Lönsamhetskalkyl - Web

Next.js fullstack webbapplikation för trafikledning, linjefiltrering och visning av ekipage/bokningar.

Övergripande repo-info finns i [../README.md](../README.md).

## Snabbstart

```bash
npm install
npm run dev
```

Öppna http://localhost:3000

## Vanliga kommandon

- `npm run dev` - startar utvecklingsservern
- `npm run build` - bygger produktion
- `npm run start` - kör byggd app lokalt

## Aktuell mappstruktur

```text
app/
  layout.tsx
  page.tsx
  login/
  home/
  notifications/
  settings/
  simulator/
  admin/
  api/
    ilog/
    import-historical/
    login/
    message/
    profitability_simulation/
    signup/
    test/
    token/
    users/

components/
  Navigation.tsx
  Footer.tsx
  LineCard.tsx
  Card.tsx

lib/
  api.ts
  areaLineConfig.ts
  ilogClient.ts
  ilogMappers.ts
  ilogTypes.ts
  taxPointLookup.ts
  supabaseServer.ts
  supabaseBrowser.ts
```

## Hur linjehämtningen fungerar (Home)

Home-flödet byggs i `app/home/useHomeDashboardData.ts` och ser ut så här:

1. Läs in användarens sparade klusterfilter (`filters.areas`).
2. Datum i UI använder `YYYY-MM-DD` (default imorgon).
3. Vid "Hämta filtrerade linjer": hämta linjer och ekipage parallellt.
4. Mappa linjer till kluster via `getLineCluster`.
5. Behåll bara linjer som matchar valda kluster.
6. Matcha ekipage mot dessa linjer via `linkedLineIds` eller `linkedLineNames`.
7. Hämta bokningar per ekipage i batchar.
8. Gör en enkel retry per consignments-anrop vid tillfälligt fel.
9. Filtrera bort ekipage som saknar bokningar.
10. Gruppera/sortera och visa i line cards + popup.

## Cache i Home

- Home använder `sessionStorage` med nyckel `home-lines-cache-v6`.
- Senast hämtade resultat återläses i samma browserflik/session.
- Cache rensas med "Rensa visning" eller när fliken stängs.

## API-endpoints

### iLog

- `GET /api/ilog/lines`
- `GET /api/ilog/equipages`
- `GET /api/ilog/consignments?date=yyyyMMdd&equipageId=xyz`
- `GET /api/ilog/consignment?consignmentId=xyz`

### Historisk import

- `POST /api/import-historical`
- `create-upload-session`
- `start-import`

#### Felkoder (historisk import)

- `400 Bad Request`: ogiltig request, saknat `filename`/`jobId`, okänd action, fel CSV-format, saknade obligatoriska kolumner eller valideringsfel i rader.
- `401 Unauthorized`: ingen giltig inloggning/session kunde verifieras.
- `403 Forbidden`: inloggad användare saknar admin-roll.
- `404 Not Found`: importjobbet hittades inte (fel `jobId` eller jobb tillhör annan admin).
- `500 Internal Server Error`: internt serverfel, t.ex. Storage-nedladdning, databasskrivning eller saknad serverkonfiguration.

Observera: CSV-filen i Storage raderas alltid efter importförsök, både vid lyckad import och vid fel.

#### Felkoder (iLog-endpoints)

- `400 Bad Request`: felaktiga eller saknade query-parametrar (t.ex. datumformat eller ID-fält).
- `502 Bad Gateway`: iLog är inte nåbart eller svarar med upstream-fel.
- `500 Internal Server Error`: oväntat serverfel i vår API-route.

## Miljövariabler

Lägg i `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ILOG_BASE_URL=...
ILOG_USERNAME=...
ILOG_TRANSPORTER_NUMBER=...
ILOG_PASSWORD=...
```

För att testa beta-varianten av iLog lokalt kan `ILOG_BASE_URL` tillfälligt sättas till `https://ilogbeta.wip.se`. När API:t returnerar `ownStatus` filtreras bokningar med värdet `Ej i lastlista` bort automatiskt i vår egen mappning. Vanligen är det `https://ilog.btf.se` som gäller.

`SUPABASE_SERVICE_ROLE_KEY` får endast användas i serverkod.

## Nattlig prognos & Analys-fliken

Varje natt kl 00:00 (svensk tid) prognostiserar systemet samtliga ekipage för
datumet **2 dagar bakåt** (körs jobbet natten till 3 juli gäller prognosen
1 juli) och sparar resultatet i Supabase-tabellen `daily_equipage_forecast`:
ekipagenamn, total vikt, total flakmeter, total prognostiserad intäkt,
antal bokningar och datum. En omkörning för samma datum skriver över raderna.

### Delar

- **Cron-jobb**: `GET /api/cron/daily-forecast` — triggas av Vercel Cron
  (se `vercel.json`, schema `0 23 * * *` UTC = 00:00/01:00 svensk tid).
  Skyddas av headern `Authorization: Bearer <CRON_SECRET>`, som Vercel Cron
  skickar automatiskt när env-variabeln `CRON_SECRET` är satt i projektet.
  Backfill/omkörning: `GET /api/cron/daily-forecast?date=YYYY-MM-DD`.
- **Prognosmotor**: `lib/forecastEngine.ts` — samma beräkningskedja som
  Hem-vyn (namnöversättning → Jaro-matchning → trappstegsmodell/flöden via
  `routeConsignment`), men helt server-side med service role. Ekipage utan
  bokningar sparas inte.
- **Analys-fliken** (`/analytics`, endast admin): välj datumintervall och ett
  eller flera ekipage, se totaler i tabell, linjegrafer för intäkt, flakmeter
  och vikt över tid, samt ladda ner underlaget som Excel.
- **API:er** (endast admin): `GET /api/analytics/forecasts`,
  `GET /api/analytics/equipages`, `GET /api/analytics/forecasts/export`
  (xlsx). Filter: `from`, `to` (YYYY-MM-DD) och valfri `equipageIds`
  (kommaseparerad).

### Uppsättning

1. Kör migrationen `supabase/migrations/20260703000000_daily_equipage_forecast.sql`
   mot Supabase-projektet (SQL-editorn eller `supabase db push`).
2. Sätt `CRON_SECRET` i Vercel-projektets miljövariabler (valfri stark sträng).
3. Deploya — Vercel läser `vercel.json` och registrerar cron-jobbet.
