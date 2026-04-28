# Simulator

Simulatorn används för att testa om oplacerade bokningar bör läggas på ett valt ekipage.

## Huvudflöde

1. Användaren väljer datum.
2. Simulatorn hämtar linjer och ekipage med samma filtreringslogik som Home.
3. Användaren väljer linje.
4. Simulatorn visar endast ekipage som faktiskt hör till vald linje enligt Home-logiken.
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

Simulatorn använder samma gemensamma funktioner som Home:

- `getFilteredLinesAndEquipagesForAreas`
- `getEquipageLinePlacement`
- `equipagePlacementMatchesLine`

Det innebär att simulatorn inte bara går på kopplade `linkedLineIds` eller `linkedLineNames`, utan även kontrollerar faktiska bokningar på ekipaget för valt datum.

## Oplacerade bokningar

Oplacerade bokningar hämtas via: /api/ilog/unassigned-consignments