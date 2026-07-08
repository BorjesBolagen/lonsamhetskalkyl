import "server-only";

/**
 * forecastAnalytics — delad läslogik för Analys-fliken.
 *
 * Läser sparade nattprognoser ur daily_equipage_forecast med filter på
 * datumintervall och (valfritt) ekipage. Används av både data- och
 * export-routen under /api/analytics.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabaseServerSchema";

export type ForecastRow =
  Database["public"]["Tables"]["daily_equipage_forecast"]["Row"];

export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Supabase returnerar max ~1000 rader per anrop; vi sidbläddrar.
const PAGE_SIZE = 1000;

export type ForecastFilter = {
  from: string;
  to: string;
  equipageIds?: number[];
};

/** Validerar och tolkar query-parametrar för from/to/equipageIds. */
export function parseForecastFilter(
  searchParams: URLSearchParams,
): { filter: ForecastFilter; error: null } | { filter: null; error: string } {
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  if (!ISO_DATE_REGEX.test(from) || !ISO_DATE_REGEX.test(to)) {
    return {
      filter: null,
      error: "from och to krävs i formatet YYYY-MM-DD",
    };
  }

  if (from > to) {
    return { filter: null, error: "from får inte vara efter to" };
  }

  const rawEquipageIds = searchParams.get("equipageIds") ?? "";
  const equipageIds = rawEquipageIds
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);

  return {
    filter: {
      from,
      to,
      equipageIds: equipageIds.length > 0 ? equipageIds : undefined,
    },
    error: null,
  };
}

/** Hämtar alla prognosrader som matchar filtret, sorterade på datum + namn. */
export async function fetchForecastRows(
  supabase: SupabaseClient<Database>,
  filter: ForecastFilter,
): Promise<ForecastRow[]> {
  const rows: ForecastRow[] = [];

  for (let page = 0; ; page++) {
    let query = supabase
      .from("daily_equipage_forecast")
      .select("*")
      .gte("forecast_date", filter.from)
      .lte("forecast_date", filter.to)
      .order("forecast_date", { ascending: true })
      .order("equipage_name", { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (filter.equipageIds) {
      query = query.in("equipage_id", filter.equipageIds);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Kunde inte läsa prognosdata: ${error.message}`);
    }

    rows.push(...(data ?? []));

    if (!data || data.length < PAGE_SIZE) {
      return rows;
    }
  }
}
