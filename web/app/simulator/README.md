# Simulator: Linjer, Ekipage och Oplacerade Bokningar

Detta dokument beskriver hur Simulator-sidan hämtar data, filtrerar linjer och ekipage enligt samma princip som Home, samt beräknar extra körkostnad för oplacerade bokningar.

## Relevanta filer

- `app/simulator/page.tsx`
- `app/simulator/useSimulatorPlanner.ts`
- `lib/backend/transportPlanningUtils.ts`
- `lib/areaLineConfig.ts`
- `lib/api.ts`
- `app/api/ilog/unassigned-consignments/route.ts`
- `app/api/ilog/consignments/route.ts`
- `app/api/distance-map/route.ts`

## Översikt av flödet

1. Simulatorn laddar användarens sparade områdesfilter via `getCurrentTransportPlanningUserSettings`.
2. Datum sätts automatiskt till imorgon som standard.
3. Linjer och ekipage hämtas och filtreras på valda kluster.
4. Simulatorn bygger sedan en Home-lik synlig linjelista genom att kontrollera vilka linjer som faktiskt får ekipage på valt datum.
5. När användaren väljer linje hämtas endast ekipage som placeras på den linjen enligt samma logik som Home.
6. När användaren väljer ekipage hämtas ekipagets nuvarande bokningar.
7. Oplacerade bokningar hämtas för vald linje och datum.
8. Användaren markerar en eller flera oplacerade bokningar.
9. Vid simulering hämtas avstånd från `distance_map` baserat på bokningens `taxPointRelation`.
10. Extra körkostnad beräknas som `distanceKm / 10 * MILPRIS_PER_MIL`.

## Linjefiltrering

Först hämtas alla linjer och ekipage. Därefter filtreras linjerna med användarens valda kluster.

Ett ekipage räknas först som kandidat om det är kopplat till en godkänd linje via:

- `linkedLineIds`
- `linkedLineNames`

Därefter görs en hårdare kontroll genom att hämta ekipagets bokningar för valt datum och placera ekipaget med samma logik som Home.

## Oplacerade bokningar

Oplacerade bokningar hämtas via:
/api/ilog/unassigned-consignments