# iLog README

Detta är en översikt över iLog-integrationen i vår frontend. Här hittar du information om viktiga filer, API-endpoints och tips för att komma igång.

## Viktiga filer
- web/lib/ilogClient.ts
- web/lib/ilogTypes.ts
- web/lib/ilogMappers.ts
- web/app/api/ilog/equipages/route.ts
- web/app/api/ilog/zones/route.ts
- web/app/api/ilog/distribution-zones/route.ts
- web/app/api/ilog/consignments/route.ts
- web/app/api/ilog/consignment/route.ts
- web/lib/api.ts

## API-endpoints (interna)
- GET /api/ilog/equipages
- GET /api/ilog/lines
- GET /api/ilog/zones?date=yyyyMMdd&withEquipages=true|false                (fungerar ej än)
- GET /api/ilog/distribution-zones?date=yyyyMMdd&withEquipages=true|false   (fungerar ej än)
- GET /api/ilog/consignments?date=yyyyMMdd&equipageId=123
- GET /api/ilog/consignment?consignmentId=123

Tips:
- Lägg till debugRaw=true på endpoints för att se rådata från iLog

## Exempel på användning i frontend
Använd helper-funktionerna i web/lib/api.ts:
- getIlogEquipages()
- getIlogLines()
- getIlogZones(date, withEquipages)             (fungerar ej än)
- getIlogDistributionZones(date, withEquipages) (fungerar ej än)
- getIlogConsignments(date, equipageId)
- getIlogConsignment(consignmentId)

## Konfiguration
Nödvandiga env-variabler (se Discord):
- ILOG_BASE_URL
- ILOG_USERNAME
- ILOG_TRANSPORTER_NUMBER
- ILOG_PASSWORD