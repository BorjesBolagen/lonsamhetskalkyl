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

-- Jämförelsen Prognos mot Utfall (Analys) visar även prognosen per intäktsgrupp.
-- Returtypen ändras, därför drop + create. Kör som anroparen, så RLS (admin) gäller.
drop function if exists public.forecast_vs_outcome(date);

create function public.forecast_vs_outcome(p_month date)
returns table (
  regnr text,
  equipage_name text,
  outcome numeric,
  forecast numeric,
  forecast_days integer,
  forecast_styckegods numeric,
  forecast_partigods numeric,
  forecast_paketbur numeric,
  forecast_egenfakturerat numeric
)
language sql
stable
as $$
  with m as (select date_trunc('month', p_month)::date as start_date),
  f as (
    select
      upper(regexp_replace(d.equipage_regnr, '[^A-Za-z0-9]', '', 'g')) as regnr,
      sum(d.total_estimated_revenue) as forecast,
      sum(d.revenue_styckegods) as styckegods,
      sum(d.revenue_partigods) as partigods,
      sum(d.revenue_paketbur) as paketbur,
      sum(d.revenue_egenfakturerat) as egenfakturerat,
      count(distinct d.forecast_date)::integer as forecast_days,
      (array_agg(d.equipage_name order by d.forecast_date desc))[1] as equipage_name
    from public.daily_equipage_forecast d, m
    where d.equipage_regnr is not null
      and d.forecast_date >= m.start_date
      and d.forecast_date < (m.start_date + interval '1 month')::date
    group by 1
  ),
  o as (
    select x.regnr, x.total_revenue
    from public.monthly_equipage_outcome x, m
    where x.month = m.start_date
  )
  select
    coalesce(f.regnr, o.regnr) as regnr,
    f.equipage_name,
    o.total_revenue as outcome,
    f.forecast,
    f.forecast_days,
    f.styckegods,
    f.partigods,
    f.paketbur,
    f.egenfakturerat
  from f
  full outer join o on o.regnr = f.regnr
  where coalesce(f.regnr, o.regnr) <> '';
$$;
