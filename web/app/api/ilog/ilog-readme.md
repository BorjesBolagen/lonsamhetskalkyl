# iLog README

## Vad som är gjort
Vi har byggt en första version av iLog-integration via backend i Next.js.
Frontend pratar med interna API-routes, och backend pratar med iLog.

Klart i v1:
- Central iLog-klient med Basic Auth, timeout och felhantering
- Fyra interna endpoints för equipages, lines, consignments och consignment-detalj
- Mapping från iLogs nested JSON till tydliga TypeScript-typer
- Stöd för debugRaw=true för felsokning
- Bortfiltrering av tomma consignment-rader
- Förbättrad vikt-fallback (estimatedweight prioriteras)

## Viktiga filer
- web/lib/ilogClient.ts
- web/lib/ilogTypes.ts
- web/lib/ilogMappers.ts
- web/app/api/ilog/equipages/route.ts
- web/app/api/ilog/consignments/route.ts
- web/app/api/ilog/consignment/route.ts
- web/lib/api.ts

## API-endpoints (interna)
- GET /api/ilog/equipages
- GET /api/ilog/lines
- GET /api/ilog/consignments?date=yyyyMMdd&equipageId=123
- GET /api/ilog/consignment?consignmentId=123

Tips:
- Lägg till debugRaw=true på endpoints för att se rådata från iLog

## Exempel på användning i frontend
Använd helper-funktionerna i web/lib/api.ts:
- getIlogEquipages()
- getIlogLines()
- getIlogConsignments(date, equipageId)
- getIlogConsignment(consignmentId)

## Konfiguration
Nödvandiga env-variabler (se Discord):
- ILOG_BASE_URL
- ILOG_USERNAME
- ILOG_TRANSPORTER_NUMBER
- ILOG_PASSWORD

## Nästa steg
- Koppla anropen i UI (dropdown för ekipage, datumval, tabell för consignments osv.)
- Klick på rad för att hämta och visa consignment detaljer
- Eventuell cachingstrategi om anropsvolymen ökar
