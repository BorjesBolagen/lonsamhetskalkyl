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

export type ForecastLogColor = "green" | "yellow" | "red" | "gray";
export type ForecastLogger = (message: string, color?: ForecastLogColor) => void;

const DEFAULT_LOGGER: ForecastLogger = (message) => {
  console.log(message);
};

// Antal ekipage som bearbetas parallellt. Hålls lågt för att inte
// överbelasta iLog och Supabase (samma tanke som Hem-vyns batchstorlek).
const EQUIPAGE_CONCURRENCY = 3;
const CONSIGNMENT_CONCURRENCY = 4;

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
  logger: ForecastLogger = DEFAULT_LOGGER,
): Promise<EquipageForecast | null> {
  const rawConsignments = await fetchConsignmentsWithRetry(ilogDate, equipage.id);

  if (rawConsignments.length === 0) {
    const message = `Ingen bokning för ekipaget ${equipage.name} (${equipage.id}). Hoppar över.`;
    logger(message, "gray");
    return null;
  }

  const consignments = await enrichTaxPointRelationFromSupabase(rawConsignments);
  const supabase = getSupabaseAdminClient();

  let totalWeightKg = 0;
  let totalFlm = 0;
  let totalEstimatedRevenue = 0;

  for (const consignment of consignments) {
    totalWeightKg += consignment.weight ?? 0;
    totalFlm += consignment.flm ?? 0;
  }

  logger(
    `Prognos för ${equipage.name} (${equipage.id}) startar med ${consignments.length} bokningar.`,
    "green",
  );

  const batches = chunk(consignments, CONSIGNMENT_CONCURRENCY);
  let processedConsignments = 0;

  for (const [batchIndex, batch] of batches.entries()) {
    const results = await Promise.allSettled(
      batch.map(async (consignment) => {
        const resolvedName = await resolveCustomerName(
          consignment.customerName,
          nameCache,
        );

        const { enrichedConsignment, input } = await prepareProfitabilityRequest(
          supabase,
          { ...consignment, customerName: resolvedName },
        );

        return await routeConsignment(enrichedConsignment, input);
      }),
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        totalEstimatedRevenue += result.value.estimated_revenue ?? 0;
      } else {
        const error = result.reason;
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger(
          `Prognos misslyckades för en bokning i ${equipage.name} (${equipage.id}): ${errorMessage}`,
          "red",
        );
      }
    }

    processedConsignments += batch.length;
    logger(
      `Prognos för ${equipage.name} (${equipage.id}) batch ${batchIndex + 1}/${batches.length} klar: ` +
        `${processedConsignments}/${consignments.length} bokningar behandlade.`,
      "green",
    );
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
  logger: ForecastLogger = DEFAULT_LOGGER,
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

    let completedEquipages = 0;
    let processedConsignmentCount = 0;

    for (const equipageBatch of chunk(equipages, EQUIPAGE_CONCURRENCY)) {
      const results = await Promise.allSettled(
        equipageBatch.map((equipage) =>
          forecastEquipage(equipage, ilogDate, nameCache, logger),
        ),
      );

      results.forEach((result, index) => {
        completedEquipages += 1;

        if (result.status === "fulfilled") {
          if (result.value) {
            forecasts.push(result.value);
            processedConsignmentCount += result.value.consignmentCount;
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

      logger(
        `Prognosprogress: ${completedEquipages}/${equipages.length} ekipage klara, ` +
          `${processedConsignmentCount} bokningar behandlade.`,
        "green"
      );
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
