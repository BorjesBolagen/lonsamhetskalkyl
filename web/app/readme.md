# App Routes

Denna mapp innehåller alla Next.js-routes för webbappen.

## Sidor

- `login` - inloggningssida
- `home` - linjer, ekipage och bokningar för valt datum
- `settings` - filter per kluster och tema
- `simulator` - simulering
- `notifications` - notiser
- `admin` - adminfunktioner och historisk import

## API-routes

- `api/ilog/*` - iLog-proxy + mapping
- `api/import-historical` - historisk CSV-import
- `api/login`, `api/token`, `api/users`, `api/message` - auth/användare/support

## Home-fördjupning

Se [home/README.md](home/README.md) för steg-för-steg-beskrivning av hämtning och filtrering.
