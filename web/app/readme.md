# App Routes

Denna mapp innehåller alla Next.js routes för applikationen.

## Sidor

- **login** - Inloggningssida (utan Navigation)
- **register** - Registreringssida (utan Navigation)
- **home** - Översikt/dashboard för trafikledare
- **calculator** - Lönsamhetskalkylator för leveranser
- **simulator** - Simuleringsverktyg för flera leveranser
- **account** - Användarkontouppgifter
- **settings** - Användarinställningar
- **admin** - Admin-panel för systemhantering

## Layout

Huvudsidor (home, calculator, simulator, account, settings, admin):
- Använder Navigation-komponenten
- Har paddingTop för att ge plats åt sticky navbar
- Har Footer längst ned
- Använder flexbox-layout

Inloggningssidor (login, register):
- Ingen Navigation
- Centrerad layout med Footer