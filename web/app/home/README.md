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

## Klusterfiltrering

`lib/areaLineConfig.ts` innehåller:

- `LINE_TO_CLUSTER`: linjenamn -> kluster
- `getLineCluster(lineName)`: hittar kluster för linjenamn, inklusive omvänt riktad linje
- `AREA_OPTIONS`/`DEFAULT_AREAS`/`parseAreaState`: model för inställningsfilter

## Ekipage-matchning

Ett ekipage behålls om minst ett av följande stämmer:

- `equipage.linkedLineIds` innehåller en godkänd linje-id
- `equipage.linkedLineNames` matchar ett godkänt linjenamn (normaliserat)

Detta gör matchningen robust även när iLog-data inte är helt konsekvent.

## Bokningshämtning och robusthet

- Bokningar hämtas via `getIlogConsignments(date, equipageId)`.
- Hämtningen körs i batchar (`chunkArray`) med `Promise.allSettled`.
- Varje bokningsanrop har en enkel retry (`getIlogConsignmentsWithRetry`).

## Detaljvy (Info-knappen)

När användaren klickar `Info` på ett ekipage:

- detaljmodal öppnas
- totalvikt och total FLM beräknas/säkerställs
- tabell visar bland annat destination, kund, hämtadress, godsuppgifter och prognos