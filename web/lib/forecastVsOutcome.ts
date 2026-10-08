import "server-only";

/**
 * forecastVsOutcome — läser jämförelsen utfall/prognos per regnr för en månad
 * (SQL-funktionen forecast_vs_outcome) och räknar ut diff.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabaseServerSchema";

export type ForecastVsOutcomeRow = {
  regnr: string;
  equipageName: string | null;
  /** null = inget utfall importerat för bilen */
  outcome: number | null;
  /** null = ingen prognos för bilen */
  forecast: number | null;
  /** Utfall minus prognos; saknad sida räknas som 0. */
  diff: number;
  /** Diff i procent av prognosen; null om prognos saknas eller är 0. */
  diffPercent: number | null;
  forecastDays: number;
};

export async function fetchForecastVsOutcome(
  supabase: SupabaseClient<Database>,
  month: string,
): Promise<ForecastVsOutcomeRow[]> {
  const { data, error } = await supabase.rpc("forecast_vs_outcome", {
    p_month: `${month}-01`,
  });

  if (error) {
    throw new Error(`Kunde inte läsa jämförelsen: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const outcome = row.outcome === null ? null : Number(row.outcome);
    const forecast = row.forecast === null ? null : Number(row.forecast);
    const diff = (outcome ?? 0) - (forecast ?? 0);
    return {
      regnr: row.regnr,
      equipageName: row.equipage_name,
      outcome,
      forecast,
      diff,
      diffPercent: forecast ? (diff / forecast) * 100 : null,
      forecastDays: row.forecast_days ?? 0,
    };
  });
}
