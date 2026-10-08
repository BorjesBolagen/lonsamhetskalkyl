-- Intäktsprognos per intäktsgrupp i den nattliga prognosen.
-- total_estimated_revenue är fortsatt totalen; de fyra nya kolumnerna är
-- delsummor (summan av dem = totalen, avrundningsdifferens på öre undantaget).
--   Styckegods     = flöde STYCKEGODS
--   Partigods      = trappstegsmodellen (steg 1-5, FJARR) + Sune
--   Paketbur       = flöde PAKETBUR
--   Egenfakturerat = flöde EGENFAKTURERAT
-- Äldre rader får 0 i alla grupper tills datumet körs om
-- (/api/cron/daily-forecast?date=YYYY-MM-DD).

alter table public.daily_equipage_forecast
  add column if not exists revenue_styckegods numeric not null default 0,
  add column if not exists revenue_partigods numeric not null default 0,
  add column if not exists revenue_paketbur numeric not null default 0,
  add column if not exists revenue_egenfakturerat numeric not null default 0;
