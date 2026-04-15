# Home: Linjer, Ekipage och Bokningar

Detta dokument beskriver hur sidan Home hämtar data från iLog, filtrerar resultat och bygger upp vyn.

## Relevanta filer

- `app/home/page.tsx`
- `app/home/useHomeLines.ts`
- `lib/areaLineConfig.ts`
- `lib/api.ts`
- `app/api/ilog/lines/route.ts`
- `app/api/ilog/equipages/route.ts`
- `app/api/ilog/consignments/route.ts`

## Översikt av flödet

1. Home laddar användarens sparade filter (`filters.areas`) via `getCurrentlySignedInUser`.
2. Användaren väljer datum (default = imorgon) och klickar på "Hämta filtrerade linjer".
3. Hooken hämtar linjer och ekipage parallellt.
4. Linjer mappas till kluster med `getLineCluster`.
5. Endast linjer i valda kluster behålls.
6. Ekipage filtreras till de som är kopplade till de godkända linjerna (via lineId eller lineName).
7. För varje kvarvarande ekipage hämtas bokningar (`consignments`) i batchar.
8. Ekipage utan bokningar filtreras bort.
9. Ekipage grupperas per visad linje och sorteras.
10. Resultatet visas i LineCards + detaljmodal.

## Datumhantering

- UI använder `YYYY-MM-DD`.
- iLog kräver `yyyyMMdd`.
- `toIlogDate` gör om formatet innan API-anrop.

Om datumformatet är ogiltigt avbryts hämtningen och felmeddelande visas.

## Klusterfiltrering

`lib/areaLineConfig.ts` innehåller:

- `LINE_TO_CLUSTER`: linjenamn -> kluster
- `getLineCluster(lineName)`: hittar kluster för linjenamn, inklusive omvänt riktad linje
- `AREA_OPTIONS`/`DEFAULT_AREAS`/`parseAreaState`: model för inställningsfilter

Viktigt:

- Filtreringen sker på klusternivå (inte på fri text i fromArea/toArea).
- "Ej relevant" är exkluderat från valbara kluster.

## Ekipage-matchning

Ett ekipage behålls om minst ett av följande stämmer:

- `equipage.linkedLineIds` innehåller en godkänd linje-id
- `equipage.linkedLineNames` matchar ett godkänt linjenamn (normaliserat)

Detta gör matchningen robust även när iLog-data inte är helt konsekvent.

## Bokningshämtning och robusthet

- Bokningar hämtas via `getIlogConsignments(date, equipageId)`.
- Hämtningen körs i batchar (`chunkArray`) med `Promise.allSettled`.
- Varje bokningsanrop har en enkel retry (`getIlogConsignmentsWithRetry`).

Syfte:

- Snabbare totalhämtning än sekventiella anrop.
- Tåligare vid tillfälliga 5xx-fel från iLog.

## Nuvarande filtreringsregler för bokningar

- Ekipage med 0 bokningar tas bort.
- Ingen extra zone-filter används i Home.
- Ingen extra innehållsfilter ("tom bokning") används i Home.

## Caching i sessionStorage

Nyckel: `home-lines-cache-v6`

Cachen sparar:

- valt datum
- beräknade lineCards
- antal kandidat-ekipage
- antal synliga ekipage
- tillämpade klusteretiketter

`Rensa visning` tar bort både UI-resultat och cache.

## Detaljvy (Info-knappen)

När användaren klickar `Info` på ett ekipage:

- detaljmodal öppnas
- totalvikt och total FLM beräknas/säkerställs
- tabell visar bland annat destination, kund, hämtadress, godsuppgifter och prognos

## Status- och felhantering i UI

Home-panelen visar olika status beroende på state:

- laddar inställningar
- laddar iLog-data
- fel vid hämtning
- inga matchande linjer
- sammanfattning av antal linjer och ekipage

Sammanfattningen baseras på `appliedClusterLabels` så texten matchar den datamängd som faktiskt visas.
