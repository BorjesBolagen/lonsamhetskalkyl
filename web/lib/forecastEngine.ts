import "server-only";

/**
 * forecastEngine — nattlig prognos per ekipage.
 *
 * Körs av /api/cron/daily-forecast (00:00 svensk tid via Vercel Cron) och gör
 * server-side exakt det som Hem-vyn gör interaktivt:
 *
 *   1. Hämtar samtliga ekipage från iLog.
 *   2. Hämtar bokningar per ekipage för måldatumet (2 dagar bakåt).
 *   3. Väljer kundnamn med samma automatik som Hem-vyns förval:
 *      namnöversättning → Jaro-matchning över tröskeln → originalnamn.
 *   4. Beräknar prognostiserad intäkt per bokning via routeConsignment.
 *   5. Aggregerar vikt, flakmeter och intäkt per ekipage och upsertar till
 *      daily_equipage_forecast. Ekipage utan bokningar sparas inte.
 *
 * All databasåtkomst sker via service role (runWithSupabaseAdminContext)
 * eftersom jobbet körs utan inloggad användare.
 */

import { ilogGet } from "@/lib/ilogClient";
import { mapConsignments, mapEquipages } from "@/lib/ilogMappers";
import { enrichTaxPointRelationFromSupabase } from "@/lib/taxPointLookup";
import { prepareProfitabilityRequest } from "@/lib/profitabilityInput";
import { routeConsignment } from "@/profitability/service";
import {
  getSupabaseAdminClient,
  runWithSupabaseAdminContext,
} from "@/lib/supabaseServer";
import { DEFAULT_NAME_SIMILARITY_THRESHOLD } from "@/lib/constants";
import type { ConsignmentListItem, EquipageItem } from "@/lib/ilogTypes";

export type DailyForecastRunSummary = {
  forecastDate: string;
  equipagesTotal: number;
  equipagesWithConsignments: number;
  rowsSaved: number;
  consignmentsProcessed: number;
  failures: { equipage: string; reason: string }[];
};

// Antal ekipage som bearbetas parallellt. Hålls lågt för att inte
// överbelasta iLog och Supabase (samma tanke som Hem-vyns batchstorlek).
const EQUIPAGE_CONCURRENCY = 3;

/** Dagens datum i Europe/Stockholm minus `daysBack` dagar, som YYYY-MM-DD. */
export function getStockholmDateDaysBack(daysBack: number): string {
  // sv-SE ger formatet YYYY-MM-DD direkt.
  const todayStockholm = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
  }).format(new Date());

  const date = new Date(`${todayStockholm}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - daysBack);
  return date.toISOString().slice(0, 10);
}

function toIlogDate(isoDate: string): string {
  return isoDate.replace(/-/g, "");
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

/** Hämtar bokningar för ett ekipage med en retry, som Hem-vyn gör. */
async function fetchConsignmentsWithRetry(
  ilogDate: string,
  equipageId: number,
): Promise<ConsignmentListItem[]> {
  const doFetch = async () => {
    const raw = await ilogGet<unknown>("/ilog-api-web/equipage/consignments", {
      date: ilogDate,
      equipageId,
      minified: "false",
    });
    return mapConsignments(raw);
  };

  try {
    return await doFetch();
  } catch {
    return await doFetch();
  }
}

/**
 * Väljer kundnamn för prognosen med samma prioritering som Hem-vyns förval:
 * 1. Namnöversättning (name_translation), 2. Jaro-matchning ≥ tröskel,
 * 3. Originalnamnet. Cachas per körning eftersom många bokningar delar kund.
 */
async function resolveCustomerName(
  customerName: string,
  cache: Map<string, string>,
): Promise<string> {
  const cached = cache.get(customerName);
  if (cached !== undefined) {
    return cached;
  }

  const supabase = getSupabaseAdminClient();
  let resolved = customerName;

  try {
    const { data: translationRows } = await supabase
      .from("name_translation")
      .select("kusk_name")
      .eq("ilog_name", customerName)
      .order("kusk_name", { ascending: true });

    const translations = (translationRows ?? [])
      .map((row) => row.kusk_name)
      .filter((name) => name && name.trim().length > 0);

    if (translations.length > 0) {
      resolved = translations[0];
    } else {
      const { data: matchRows } = await supabase.rpc("find_best_name_match", {
        input_name: customerName,
      });

      const bestMatch = matchRows?.[0];
      if (
        bestMatch &&
        bestMatch.best_score >= DEFAULT_NAME_SIMILARITY_THRESHOLD
      ) {
        resolved = bestMatch.best_name;
      }
    }
  } catch (error) {
    console.error(
      `Namnuppslag misslyckades för "${customerName}", använder originalnamnet:`,
      error instanceof Error ? error.message : error,
    );
  }

  cache.set(customerName, resolved);
  return resolved;
}

type EquipageForecast = {
  equipage: EquipageItem;
  totalWeightKg: number;
  totalFlm: number;
  totalEstimatedRevenue: number;
  consignmentCount: number;
};

/** Prognostiserar alla bokningar för ett ekipage och summerar. */
async function forecastEquipage(
  equipage: EquipageItem,
  ilogDate: string,
  nameCache: Map<string, string>,
): Promise<EquipageForecast | null> {
  const rawConsignments = await fetchConsignmentsWithRetry(ilogDate, equipage.id);

  if (rawConsignments.length === 0) {
    return null;
  }

  const consignments =
    await enrichTaxPointRelationFromSupabase(rawConsignments);

  const supabase = getSupabaseAdminClient();

  let totalWeightKg = 0;
  let totalFlm = 0;
  let totalEstimatedRevenue = 0;

  for (const consignment of consignments) {
    totalWeightKg += consignment.weight ?? 0;
    totalFlm += consignment.flm ?? 0;

    try {
      const resolvedName = await resolveCustomerName(
        consignment.customerName,
        nameCache,
      );

      const { enrichedConsignment, input } = await prepareProfitabilityRequest(
        supabase,
        { ...consignment, customerName: resolvedName },
      );

      const result = await routeConsignment(enrichedConsignment, input);
      totalEstimatedRevenue += result.estimated_revenue ?? 0;
    } catch (error) {
      // Samma beteende som Hem-vyn: en misslyckad beräkning ger 0 kr
      // för den bokningen men stoppar inte resten av ekipaget.
      console.error(
        `Prognos misslyckades för bokning ${consignment.consignmentId} (${equipage.name}):`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return {
    equipage,
    totalWeightKg,
    totalFlm,
    totalEstimatedRevenue: Math.round(totalEstimatedRevenue * 100) / 100,
    consignmentCount: consignments.length,
  };
}

/**
 * Kör hela den nattliga prognosen för ett datum (YYYY-MM-DD) och sparar
 * resultatet i daily_equipage_forecast. Körningen är idempotent: en
 * omkörning för samma datum skriver över befintliga rader.
 */
export async function runDailyEquipageForecast(
  forecastDate: string,
): Promise<DailyForecastRunSummary> {
  return runWithSupabaseAdminContext(async () => {
    const ilogDate = toIlogDate(forecastDate);

    const rawEquipages = await ilogGet<unknown[]>(
      "/ilog-api-web/driver/equipages",
    );
    const equipages = mapEquipages(rawEquipages);

    const nameCache = new Map<string, string>();
    const forecasts: EquipageForecast[] = [];
    const failures: DailyForecastRunSummary["failures"] = [];

    for (const equipageBatch of chunk(equipages, EQUIPAGE_CONCURRENCY)) {
      const results = await Promise.allSettled(
        equipageBatch.map((equipage) =>
          forecastEquipage(equipage, ilogDate, nameCache),
        ),
      );

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          if (result.value) {
            forecasts.push(result.value);
          }
        } else {
          failures.push({
            equipage: equipageBatch[index].name,
            reason:
              result.reason instanceof Error
                ? result.reason.message
                : String(result.reason),
          });
        }
      });
    }

    let rowsSaved = 0;

    if (forecasts.length > 0) {
      const supabase = getSupabaseAdminClient();
      const now = new Date().toISOString();

      const { error } = await supabase.from("daily_equipage_forecast").upsert(
        forecasts.map((forecast) => ({
          forecast_date: forecastDate,
          equipage_id: forecast.equipage.id,
          equipage_name: forecast.equipage.name,
          total_weight_kg: forecast.totalWeightKg,
          total_flm: forecast.totalFlm,
          total_estimated_revenue: forecast.totalEstimatedRevenue,
          consignment_count: forecast.consignmentCount,
          updated_at: now,
        })),
        { onConflict: "forecast_date,equipage_id" },
      );

      if (error) {
        throw new Error(`Kunde inte spara prognoser: ${error.message}`);
      }

      rowsSaved = forecasts.length;
    }

    return {
      forecastDate,
      equipagesTotal: equipages.length,
      equipagesWithConsignments: forecasts.length,
      rowsSaved,
      consignmentsProcessed: forecasts.reduce(
        (sum, forecast) => sum + forecast.consignmentCount,
        0,
      ),
      failures,
    };
  });
}
