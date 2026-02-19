# API

This folder contains Next.js route handlers under app/api.

## /api/message

Handled by app/api/message/route.ts.

- POST: Accepts JSON with "message" and optional "sentAt"; validates input and writes a row to the "messages" table via Supabase.
- GET: Health-check style endpoint that returns { "status": "ok" }.
