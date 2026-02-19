# Web

Minimal Next.js fullstack app with a login entry page and a simple dashboard that posts messages to the internal API.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Environment variables

Frontend & Backend (public):

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL

Backend only (secret):

- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-side only, never expose to frontend)

## Structure

- `app/` Next.js routes and layout
- `components/` Reusable UI, including `LoginPage`
- `styles/` Global styles (Tailwind)
