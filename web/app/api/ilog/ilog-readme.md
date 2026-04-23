# iLog README

Översikt över iLog-integrationen i webappen.

## Viktiga filer

- `web/lib/ilogClient.ts`
- `web/lib/ilogTypes.ts`
- `web/lib/ilogMappers.ts`
- `web/lib/taxPointLookup.ts`
- `web/app/api/ilog/lines/route.ts`
- `web/app/api/ilog/equipages/route.ts`
- `web/app/api/ilog/consignments/route.ts`
- `web/app/api/ilog/consignment/route.ts`
- `web/lib/api.ts`

## API-endpoints (interna)

- `GET /api/ilog/lines`
- `GET /api/ilog/equipages`
- `GET /api/ilog/consignments?date=yyyyMMdd&equipageId=123`
- `GET /api/ilog/consignment?consignmentId=123`

Obs: `zones` och `distribution-zones` är borttagna.

## Consignments-flöde

1. Route hämtar rådata från iLog.
2. `mapConsignments` mappar till interna typer (`ConsignmentListItem`).
3. `enrichTaxPointRelationFromSupabase` försöker berika med `taxPointRelation`.
4. Om Supabase-lookup misslyckas returneras consignments ändå (utan att endpointen kraschar).

Tips:

- Lägg till `debugRaw=true` på flera iLog-endpoints för att inspektera rådata.

## Frontend-anrop (lib/api.ts)

- `getIlogLines()`
- `getIlogEquipages()`
- `getIlogConsignments(date, equipageId)`
- `getIlogConsignment(consignmentId)`

## Konfiguration

Nödvändiga env-variabler:

- `ILOG_BASE_URL`
- `ILOG_USERNAME`
- `ILOG_TRANSPORTER_NUMBER`
- `ILOG_PASSWORD`
