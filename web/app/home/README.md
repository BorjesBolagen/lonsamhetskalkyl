# Home: Linjer, Ekipage och Bokningar

Detta dokument beskriver hur sidan Home hämtar data från iLog, filtrerar resultat och bygger upp vyn.

## Relevanta filer

- `app/home/page.tsx`
- `app/home/useHomeDashboardData.ts`
- `app/home/hooks/homeTypesAndUtils.ts`
- `app/home/hooks/useHomePreferences.ts`
- `app/home/hooks/useHomeCache.ts`
- `app/home/hooks/useHomeLineState.ts`
- `app/home/hooks/useHomeProfitability.ts`
- `app/home/hooks/useHomeLoader.ts`

## Arkitektur i korthet

- `useHomeDashboardData` (i `useHomeDashboardData.ts`) är huvudhooken som kopplar ihop alla del-hooks.
- `useHomePreferences` hanterar användarens sparade inställningar och datum.
- `useHomeCacheRestore` laddar tidigare Home-resultat från sessionStorage.
- `useHomeLineState` hanterar line/equipage-state och state-uppdateringar.
- `useHomeLoader` hämtar linjer, ekipage och consignments samt refresh-flöden.
- `useHomeProfitability` tilldelar consignments med prognosvärden.
- `homeTypesAndUtils` innehåller typer och ren hjälplogik.

## Översikt av dataflödet

1. Home laddar användarens sparade filter via `getCurrentlySignedInUser`.
2. Användaren väljer datum (default = imorgon) och klickar på "Hämta filtrerade linjer".
3. Linjer och ekipage hämtas parallellt.
4. Linjer mappas till kluster med `getLineCluster`.
5. Endast linjer i valda kluster behålls.
6. Ekipage matchas mot godkända linjer via lineId eller normaliserat lineName.
7. Consignments hämtas i batchar per ekipage.
8. Ekipage utan consignments filtreras bort.
9. Ekipage grupperas/sorteras per visad linje.
10. Profitability beräknas asynkront per consignment efter initial rendering.

## Detaljvy (Info-knappen)

När användaren klickar `Info` på ett ekipage:

- detaljmodal öppnas
- totalvikt och total FLM beräknas/säkerställs
- tabell visar bland annat destination, kund, hämtadress, godsuppgifter och prognos