# Simulator

Simulatorn används för att testa om oplacerade bokningar bör läggas på ett valt ekipage.

## Huvudflöde

1. Användaren väljer datum.
2. Simulatorn hämtar linjer och ekipage från iLog och filtrerar dem på användarens
   urval i Inställningar, samma urvalskälla som Home.
3. Användaren väljer linje.
4. Simulatorn visar endast ekipage som hör till vald linje.
5. Användaren väljer ekipage.
6. Simulatorn hämtar ekipagets nuvarande bokningar.
7. Simulatorn hämtar oplacerade bokningar för vald linje.
8. Användaren väljer en eller flera oplacerade bokningar.
9. Vid simulering beräknas:
   - extra km
   - extra körkostnad
   - intäkt
   - prognos/marginal

## Linjer och ekipage

Urvalet styrs av `filters.vehicleSelectorMode`, `filters.lines` och
`filters.equipages` som sparas på inställningssidan:

- **Linjeläge** – linjelistan är användarens valda linjer.
- **Ekipageläge** – linjelistan härleds från de valda ekipagens `linkedLineIds`
  och `linkedLineNames`. Ett valt ekipage utan kopplad linje får en egen
  pseudolinje (negativt id, `type: "EQUIPAGE"`) så att det ändå går att välja.
  Sådana pseudolinjer har inga oplacerade bokningar i iLog.
- **Utan sparat urval** – alla linjer visas, tillsammans med en notis om att
  inget urval finns i Inställningar.

Gemensamma funktioner i `lib/backend/transportPlanningUtils`:

- `getLinesForVehicleSelection`
- `getEquipagesForSelectedLine`
- `scopeEquipagesForVehicleSelection`

Det äldre områdes-/klusterfiltret (`filters.areas`) används inte längre av
simulatorn. Det togs bort från inställningssidan och var tomt för de flesta
användare, vilket gjorde både linje- och ekipagelistan tom.

## Oplacerade bokningar

Oplacerade bokningar hämtas via: /api/ilog/unassigned-consignments
