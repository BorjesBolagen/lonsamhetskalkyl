# Simulator

Simulatorn används för att testa om oplacerade och fiktiva bokningar bör
läggas på ett valt ekipage.

## Huvudflöde

1.  Användaren väljer datum.
2.  Simulatorn hämtar linjer och ekipage med samma filtreringslogik som
    Home.
3.  Användaren väljer linje.
4.  Simulatorn visar endast ekipage som faktiskt hör till vald linje
    enligt Home-logiken.
5.  Användaren väljer ekipage.
6.  Simulatorn hämtar ekipagets nuvarande bokningar.
7.  Simulatorn hämtar oplacerade bokningar för vald linje.
8.  Användaren kan:
    -   välja oplacerade bokningar
    -   lägga till fiktiva bokningar
9.  Vid simulering beräknas:
    -   extra km
    -   extra körkostnad
    -   intäkt
    -   prognos/marginal

## Linjer och ekipage

Simulatorn använder samma gemensamma funktioner som Home:

-   getFilteredLinesAndEquipagesForAreas
-   getEquipageLinePlacement
-   equipagePlacementMatchesLine

## Oplacerade bokningar

Oplacerade bokningar hämtas via:

/api/ilog/unassigned-consignments

## Fiktiva bokningar

Användaren kan lägga till egna bokningar via "Lägg till fiktiv bokning".

### Inputkrav

-   Taxerelation: format 12345-12345 och måste finnas i distance_map
-   Pris: positivt tal (\> 0)

## Hantering av saknade avstånd

Om en taxerelation inte finns:

Taxepoint X-Y finns inte, kan inte beräkna avstånd.

## UI-beteende

### Rensa val

Tar bort endast markeringar

### Återställ

Tar bort alla markeringar och simuleringsresultat
