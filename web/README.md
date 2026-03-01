# Lönsamhetskalkyl - Web Frontend

Next.js fullstack webbapplikation för ett trafikledningssystem med lönsamhetskalkylering för leveranser.

**Arkitektur & allmän info:** Se [../README.md](../README.md)

## Funktioner

Webbappen erbjuder följande sidor för trafikledare och administratörer:

- **Login** - Autentisering för trafikledare
- **Registrering** - Nya användare kan registrera sig
- **Översikt** - Dashboard med statusöversikt över nuvarande leveranser
- **Kalkylator** - Beräkna lönsamhet för enskilda leveranser mellan två platser
- **Simulator** - Planera och simulera flera leveranser samtidigt
- **Inställningar** - Användarinställningar och områdeshantering
- **Konto** - Användarkontouppgifter och profilinformation
- **Admin** - Administrativ panel för användarhantering och system-testning

## Installation & Startup

```bash
npm install
npm run dev
```

Öppna `http://localhost:3000`

### Tillgängliga kommandon

- `npm run dev` - Start dev server (Turbopack)
- `npm run build` - Build för produktion
- `npm run start` - Kör producerad build lokalt

## Mappstruktur

```
app/
├── layout.tsx              # Root layout för alla sidor
├── page.tsx                # Root page (/)
├── login/                  # Inloggningssida
├── register/               # Registreringssida
├── home/                   # Översikt/dashboard
├── calculator/             # Lönsamhetskalkylator
├── simulator/              # Simuleringsverktyg
├── account/                # Användarhantering
├── settings/               # Inställningar
├── admin/                  # Admin-panel
└── api/
    └── message/            # API-endpoint för meddelanden

components/
├── Navigation.tsx          # Sticky navigationsbalk (alla sidor utom login/register)
├── Footer.tsx              # Sidfot (alla sidor)

lib/
├── api.ts                  # API-hjälpfunktioner (sendMessage)
├── supabaseServer.ts       # Supabase server-klient
├── readme.md               # Lib-dokumentation

styles/
├── constants.ts            # Centraliserade styling-konstanter
└── globals.css             # Global CSS

public/
└── static files            # Publika assets
```

## API-Endpoints

### POST /api/message

Skapar ett nytt meddelande i Supabase.

**Request Body:**

```json
{
  "message": "Meddelande text",
  "sentAt": "HH:MM:SS"
}
```

**Response (200):**

```json
{
  "received": "Meddelande text",
  "sentAt": "HH:MM:SS"
}
```

### GET /api/message

Hälsokontroll för API-endpointen.

**Response:**

```json
{
  "status": "ok"
}
```


### Miljövaribler

Se rot-[README.md](../README.md#miljövaribler) för full dokumentation av miljövariabler.
Dessa behövs och kan fås från Supabase om man vill ha möjlighet att köra och testa API-endpointen lokalt.

Lokalt i `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```
