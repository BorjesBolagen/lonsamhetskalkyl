/**
 * GET /api/analytics/equipages
 *
 * Listar de ekipage som förekommer i den sparade prognosdatan
 * (daily_equipage_forecast), för Analys-flikens ekipageval. Endast admin.
 *
 * Response: { status, message, data: { id, name }[] }
 */

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/authHelpers";

export async function GET() {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const supabase = await getSupabaseServerClient();

    // Deduplicera: samma ekipage förekommer en gång per sparat datum.
    // Sidbläddra eftersom Supabase returnerar max ~1000 rader per anrop.
    const byId = new Map<number, string>();
    const PAGE_SIZE = 1000;

    for (let page = 0; ; page++) {
      const { data, error } = await supabase
        .from("daily_equipage_forecast")
        .select("equipage_id, equipage_name")
        .order("equipage_id", { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) {
        throw new Error(error.message);
      }

      for (const row of data ?? []) {
        if (!byId.has(row.equipage_id)) {
          byId.set(row.equipage_id, row.equipage_name);
        }
      }

      if (!data || data.length < PAGE_SIZE) {
        break;
      }
    }

    const equipages = Array.from(byId.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "sv"));

    return NextResponse.json({
      status: true,
      message: "Ekipage hämtade",
      data: equipages,
    });
  } catch (fetchError) {
    console.error("analytics/equipages error:", fetchError);
    return NextResponse.json(
      {
        status: false,
        message:
          fetchError instanceof Error
            ? fetchError.message
            : "Kunde inte hämta ekipage",
      },
      { status: 500 },
    );
  }
}
