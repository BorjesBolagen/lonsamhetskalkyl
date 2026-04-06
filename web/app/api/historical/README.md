# Historical CSV Import README

## Vad den här endpointen gör

Endpointen importerar historisk KUSK-data från en CSV-fil till tabellen Historical_shipment i Supabase.

Flödet är byggt för admin-användning och kör all-or-nothing:

- alla rader måste validera
- om en rad är fel stoppas hela importen
- inga partiella inserts ska ligga kvar

## Fil och endpoint

- Route-fil: web/app/api/historical/route.ts
- Endpoint: POST /api/historical

## Säkerhet

Innan importen startar kontrolleras:

- att användaren är inloggad
- att användaren har rollen admin

Själva write till databasen görs med service-role-klient, men endast efter dessa kontroller.

## Request-format

Importen tar emot form-data med ett filfält:

- field name: file
- filtyp: .csv

## CSV-format och krav

Parsern förväntar sig semikolon-separerad CSV och hanterar citattecken i fält.

Obligatoriska headers:

- avbgsp_id
- Fraktsedelsnr
- Kundnr
- Kundnamn
- Linjenr
- Avsändandeort
- Avs postnr
- Bestammelseort
- Bes postnr
- Lf-datum
- Avräkningsdatum
- Ers exk tillägg
- Ers ink tillägg
- Kundnettofrakt
- DMT
- Enhet
- Fraktgrundandevikt

Om någon obligatorisk header saknas returneras 400.

## Datamappning (översikt)

CSV-fält mappas till Historical_shipment.
Några viktiga regler i nuvarande implementation:

- customer_name blir null om Kundnamn är tom
- DMT normaliseras till number, fallback till 0 om tom
- FLM sätts till null
- Volume sätts till null
- Weight tas från Fraktgrundandevikt

## Validering

Varje rad valideras innan insert byggs upp.
Exempel på fel:

- ogiltiga nummerfält
- saknade orter
- ogiltiga datum
- saknat enhet

Om valideringsfel finns returneras:

- status: false
- message: första felet
- data.errors: lista med valideringsfel

## Insert-strategi

Efter validering skrivs rader i batchar (500 per batch) till Supabase.
Detta minskar risk för timeout och gör progressrapportering under DB-fasen möjlig.

## Progress-lägen

Endpointen stödjer två lägen:

1. Vanligt JSON-svar

- används om header x-import-progress saknas
- returnerar svar först när hela importen är klar eller felar

2. Streamad progress (NDJSON)

- aktiveras med header: x-import-progress: 1
- svarar med en stream av JSON-rader
- Content-Type: application/x-ndjson

Meddelandetyper i streamen:

- progress
- result
- error

## Svarskoder (sammanfattning)

- 200: import klar
- 400: valideringsfel eller felaktig fil
- 401: ej verifierad användare
- 403: ej admin
- 500: serverfel eller databasfel

## Koppling till frontend

Frontend använder helpern importHistoricalCSV i web/lib/api.ts.
Den helpern:

- laddar upp filen
- lyssnar på upload-progress
- läser streamad serverprogress (NDJSON)
- mappar fel till HistoricalImportError

Admin-UI finns i web/app/admin/page.tsx.
