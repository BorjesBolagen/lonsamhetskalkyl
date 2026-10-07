-- Sparar bilens registreringsnummer per ekipage i den nattliga prognosen.
-- equipage_name är bilens namn (t.ex. "L80"); regnr hämtas från ekipagets
-- truck-resurs i iLog. Nullable: äldre rader (fylls av engångs-backfill) och
-- ekipage utan bil saknar regnr.

alter table public.daily_equipage_forecast
  add column if not exists equipage_regnr text;

create index if not exists daily_equipage_forecast_regnr_idx
  on public.daily_equipage_forecast (equipage_regnr);
