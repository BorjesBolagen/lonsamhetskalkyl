# Lönsamhetskalkyl

Kandidatprojekt vid Linköpings Universitet åt Börjes Koncernen att ta fram ett program som ska räkna på lönsamhet.

## Fullstack i Next.js - förklaring och arkitektur

Denna sektion beskriver hur ett fullstack-upplägg i Next.js fungerar, hur Supabase samt server/client-side delas upp och varför filstrukturen ser ut som den gör.

### Vad menas med fullstack i Next.js

Next.js frameworket kan innehålla:

- Frontend (UI som körs i webbläsaren)
- Backend (server-side logik, API-routes, och data-hämtning)

Det betyder att ni kan lägga affärslogik och databasanrop i Next.js utan en separat backend-server. Allt deployas som en app, men det finns fortfarande en tydlig gräns mellan server-side och client-side kod.

### Varför filstrukturen ser ut som den gör

Projektet är uppdelat för att ge tydlig separation mellan UI, serverlogik och framtida ML:

- [web/app](web/app) innehåller routes och sidor i Next.js (App Router).
- [web/app/api](web/app/api) innehåller API-routes som körs server-side.
- [web/components](web/components) innehåller återanvändbara UI-komponenter.
- [web/lib](web/lib) innehåller delad logik, API-klienter och server-only helpers.
- [web/styles](web/styles) innehåller globala styles (Tailwind CSS).
- [ml-backend](ml-backend) är en placeholder för framtida ML/NN-service (se längre ned).

Denna uppdelning gör det enkelt att hålla enkel beräkningslogik nära UI:t, samtidigt som tunga ML-beräkningar kan flyttas ut utan att ändra frontend-kontraktet.

### Kommunikation med Supabase

Supabase ska alltid anropas server-side om ni använder hemliga nycklar.

- I Next.js fullstack: Supabase-klienten ligger i server-side kod (t.ex. API-routes eller server components)

Exakta filer där Supabase används:

- [web/lib/supabaseServer.ts](web/lib/supabaseServer.ts) skapar en server-only Supabase-klient.
- [web/app/api/message/route.ts](web/app/api/message/route.ts) anropar Supabase och sparar data.

Viktigt:

- `SUPABASE_SERVICE_ROLE_KEY` får aldrig exponeras till klienten.
- Klientkod får bara använda `NEXT_PUBLIC_` env om det är harmlöst.

### Hur allt pratar inom Next.js

Vanligt dataflöde i fullstack:

1. Frontend (client component) begär data
2. Next.js server-side kod (server component eller API-route) gör beräkning eller DB-anrop
3. Resultat skickas tillbaka till klienten som JSON eller renderad HTML

Du kan välja att:

- Hämta data direkt i en server component (snabbt, inget extra API-anrop i klienten)
- Skapa en `app/api/...` route som klienten anropar med `fetch`

Exakta filer för dagens flöde:

- [web/app/dashboard/page.tsx](web/app/dashboard/page.tsx) skickar meddelanden.
- [web/lib/api.ts](web/lib/api.ts) gör `fetch` mot `/api/message`.
- [web/app/api/message/route.ts](web/app/api/message/route.ts) tar emot och sparar via Supabase.

### Vad blir all koden skriven i

- Frontend och backend i Next.js skrivs i TypeScript.
- UI-styling görs med Tailwind CSS (globalt via [web/styles/globals.css](web/styles/globals.css)).
- Den eventuellt framtida ML/NN-backenden planeras i Python.

### Hur vet jag vad som är server-side och client-side

I Next.js (app router):

- Server components är default. De kör på servern.
- Client components markeras med `"use client"` högst upp i filen. De kör i webbläsaren.
- API-routes ligger under `app/api/` och kör alltid server-side.

Snabb tumregel:

- Om du använder `window`, `document`, eller event handlers (onClick) är det client-side.
- Om du läser hemliga env eller pratar med DB är det server-side.

### Konkreta exempel: server-side vs client-side

- [web/app/dashboard/page.tsx](web/app/dashboard/page.tsx) är client-side eftersom filen har `"use client"` och använder state.
- [web/app/api/message/route.ts](web/app/api/message/route.ts) är server-side eftersom det är en API-route och läser env/Supabase.
- [web/lib/supabaseServer.ts](web/lib/supabaseServer.ts) är server-only och kan aldrig importeras i klientkod.

### Framtida ML/NN-backend i Python (förslag)

För tunga beräkningar är en separat Python-service bäst. Rekommenderat upplägg:

- FastAPI + Uvicorn (snabbt, tydliga typer, enkel deployment).
- En separat deployment (egen URL) som Next.js anropar server-side.
- Om beräkningar tar lång tid: använd job queue (t.ex. Redis + Celery) och returnera `jobId`.

Det gör att Next.js kan fortsätta vara snabb i UI:t, medan ML-tjänsten kan skala på egna resurser (CPU/GPU) utan att påverka webbappen.
