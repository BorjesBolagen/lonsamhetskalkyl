# Backend

Minimal Express backend used by the frontend dashboard.

## Run locally

```bash
npm install
npm run dev
```

Default server URL: http://localhost:5000

## Environment variables

- `FRONTEND_URL` - Allowed frontend origin for CORS
- `SUPABASE_URL` - Required only if you enable Supabase features
- `SUPABASE_SERVICE_ROLE_KEY` - Required only if you enable Supabase features

## Routes

- `GET /` - Health page showing the latest message
- `POST /api/message` - Accepts `{ message, sentAt }` and echoes back
