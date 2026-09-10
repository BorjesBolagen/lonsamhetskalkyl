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
8. Consignments med `ownStatus = Ej i lastlista` filtreras bort när API:t returnerar fältet.
9. Ekipage utan consignments filtreras bort.
10. Ekipage grupperas/sorteras per visad linje.
11. Profitability beräknas asynkront per consignment efter initial rendering.

## Nytt linjeval (tillfällig admin-testväg)

Linjeläget har just nu **två** vägar. Den vanliga knappen kör oförändrat (steg 1-11
ovan). Admins ser dessutom knappen "Nytt linjeval", som kör
`loadLineCardsByConsignmentLines` i stället för `loadLineCards`.

Skillnaden är vilken fråga som ställs till iLog:

- Gamla vägen frågar **bilen** vilka linjer den är taggad med
  (`linkedLineIds`/`linkedLineNames`), hämtar bokningar för de bilarna och lägger bilen
  på en linje via `getDominantConsignmentLineName`. En bil vars tagg pekar någon
  annanstans kommer aldrig med, även om den kör gods på linjen.
- Nya vägen frågar **linjen** vilka bokningar den har, via
  `/api/ilog/line-consignments` (som i sin tur går mot iLog:s
  `zone`/`zonefilter`/`zonegroup`-consignments). Varje bokning pekar ut sitt ekipage,
  och bilen hamnar på varje vald linje den har en bokning på. Linjetaggen används inte.

Ekipaget slås upp på `consignment.equipageId` när iLog skickar det, annars på
`equipageName` mot listan från `/driver/equipages`. Är id:t satt men bilen ligger
utanför användarens grupp syntetiseras ett minimalt `EquipageItem` så bilen ändå kan
visas.

När placeringarna är klara hämtas **hela** dagens bokningslista per bil, så kortet
visar bilen och inte bara de valda linjernas gods. Allt på bilnivå är därmed
oförändrat: lönsamheten beräknas en gång per bil, och eftersom `updateEquipageInState`
matchar på `equipage.id` speglas varje uppdatering till alla kort där bilen förekommer.
Räknaren "N linjer med totalt M ekipage" räknar distinkta ekipage-id.

Två räknare i statusrutan finns för att en bil som uteblir ska synas i stället för att
tyst försvinna: `unavailableEquipageCount` är differensen mellan upptäckta och visade
bilar oavsett orsak (okänt ekipage, misslyckat anrop, inga bokningar kvar efter
filtrering), och `failedLineCount` är antalet linjer vars bokningar inte gick att
hämta - en sådan linje tar annars med sig alla sina bilar utan spår.

Valet är inte sparat i användarens inställningar: det ligger i `groupByConsignmentLines`
i `useHomeDashboardData` och följer med i sessionStorage-cachen, så det överlever en
sidladdning men nollställs vid ny session eller när den vanliga knappen används.

Admin-gatet är en UI-avgränsning, inte en säkerhetsgräns - grupperingen sker i klienten
på data användaren redan har åtkomst till.

Kända avgränsningar: bokningar på en vald linje **utan** ekipage visas inte alls (de
ligger inte på någon bil - simulatorn är stället för dem), och en refresh flyttar inte
en bil till en ny linje förrän hela vyn hämtas om.

När den nya vägen är verifierad i drift tas följande bort:

- `loadLineCards` och grenen i `loadLines` i `useHomeLoader.ts`
- `getDominantConsignmentLineName` i `homeTypesAndUtils.ts`
- `groupByConsignmentLines`/`setGroupByConsignmentLines` genom hook-kedjan och
  `HomeCachePayload`
- knappen "Nytt linjeval", test-markören i statusrutan och `isAdmin` i
  `useHomePreferences` (om inget annat använder den då)

Nya filer som stannar oavsett: `lib/ilogLineEndpoints.ts`,
`app/api/ilog/line-consignments/route.ts`, `getIlogLineConsignments` i `lib/api.ts` och
`equipageId` på `ConsignmentListItem`.

## Detaljvy (Info-knappen)

När användaren klickar `Info` på ett ekipage:

- detaljmodal öppnas
- totalvikt och total FLM beräknas/säkerställs
- tabell visar bland annat destination, kund, hämtadress, godsuppgifter och prognos