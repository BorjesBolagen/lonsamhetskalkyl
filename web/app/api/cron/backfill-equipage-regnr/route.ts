/**
 * GET /api/cron/backfill-equipage-regnr
 *
 * Engångs-backfill av daily_equipage_forecast.equipage_regnr. Endast admin.
 *
 * Hämtar ekipagelistan från iLog och sätter dagens regnr på ALLA historiska
 * rader för samma equipage_id (dagens status gäller bakåt). Rader som redan
 * har ett regnr rörs inte, så körningen kan göras om utan risk.
 *
 * Query params:
 *   - apply=true → skriv till databasen. Utan param görs en torrkörning som
 *                  bara rapporterar vad som skulle ändras.
 *
 * Response: { status, dryRun, summary }
 *   summary.notUpdated listar ekipage som saknar regnr i iLog (borttagna
 *   ekipage eller ekipage utan bil) och därför behåller null.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authHelpers";
import { ilogGet } from "@/lib/ilogClient";
import { mapEquipages } from "@/lib/ilogMappers";
import { getSupabaseAdminClient } from "@/lib/supabaseServer";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const PAGE_SIZE = 1000;
const UPDATE_CONCURRENCY = 10;

type MissingRegnrRow = { equipage_id: number; equipage_name: string };

/** Läser alla rader utan regnr (PostgREST returnerar max 1000 rader/sida). */
async function fetchRowsWithoutRegnr(): Promise<MissingRegnrRow[]> {
  const supabase = getSupabaseAdminClient();
  const rows: MissingRegnrRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("daily_equipage_forecast")
      .select("equipage_id, equipage_name")
      .is("equipage_regnr", null)
      .order("equipage_id", { ascending: true })
      .order("forecast_date", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Kunde inte läsa prognosrader: ${error.message}`);
    }

    rows.push(...data);

    if (data.length < PAGE_SIZE) {
      return rows;
    }
  }
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const dryRun = new URL(request.url).searchParams.get("apply") !== "true";

  try {
    const rawEquipages = await ilogGet<unknown[]>(
      "/ilog-api-web/driver/equipages",
    );
    const equipages = mapEquipages(rawEquipages);

    const regnrById = new Map<number, string>();
    for (const equipage of equipages) {
      if (equipage.regnr) {
        regnrById.set(equipage.id, equipage.regnr);
      }
    }

    const rowsWithoutRegnr = await fetchRowsWithoutRegnr();

    // Antal rader och namn per equipage_id som saknar regnr.
    const missingById = new Map<number, { name: string; rows: number }>();
    for (const row of rowsWithoutRegnr) {
      const entry = missingById.get(row.equipage_id);
      if (entry) {
        entry.rows += 1;
      } else {
        missingById.set(row.equipage_id, { name: row.equipage_name, rows: 1 });
      }
    }

    const toUpdate = [...missingById].filter(([id]) => regnrById.has(id));
    const notUpdated = [...missingById]
      .filter(([id]) => !regnrById.has(id))
      .map(([id, { name, rows }]) => ({ equipageId: id, name, rows }));

    let rowsUpdated = 0;
    const failures: { equipageId: number; reason: string }[] = [];

    if (!dryRun) {
      const supabase = getSupabaseAdminClient();

      for (let i = 0; i < toUpdate.length; i += UPDATE_CONCURRENCY) {
        const batch = toUpdate.slice(i, i + UPDATE_CONCURRENCY);

        await Promise.all(
          batch.map(async ([equipageId]) => {
            const { count, error } = await supabase
              .from("daily_equipage_forecast")
              .update(
                { equipage_regnr: regnrById.get(equipageId)! },
                { count: "exact" },
              )
              .eq("equipage_id", equipageId)
              .is("equipage_regnr", null);

            if (error) {
              failures.push({ equipageId, reason: error.message });
            } else {
              rowsUpdated += count ?? 0;
            }
          }),
        );
      }
    }

    return NextResponse.json({
      status: true,
      dryRun,
      message: dryRun
        ? "Torrkörning: inget har skrivits. Lägg till ?apply=true för att köra på riktigt."
        : "Backfill klar.",
      summary: {
        equipagesInIlog: equipages.length,
        equipagesWithRegnrInIlog: regnrById.size,
        rowsWithoutRegnr: rowsWithoutRegnr.length,
        equipagesToUpdate: toUpdate.length,
        rowsToUpdate: toUpdate.reduce((sum, [, { rows }]) => sum + rows, 0),
        rowsUpdated,
        notUpdated,
        failures,
      },
    });
  } catch (error) {
    console.error("Backfill av regnr misslyckades:", error);

    return NextResponse.json(
      {
        status: false,
        message:
          error instanceof Error ? error.message : "Okänt fel i backfillen",
      },
      { status: 500 },
    );
  }
}
