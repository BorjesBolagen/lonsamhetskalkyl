/**
 * GET /api/analytics/forecasts
 *
 * Hämtar sparade nattprognoser för Analys-fliken (endast admin).
 *
 * Query params:
 *   - from (YYYY-MM-DD, krävs)
 *   - to (YYYY-MM-DD, krävs)
 *   - equipageIds (valfri, kommaseparerad lista av ekipage-id)
 *
 * Response: { status, message, data: ForecastRow[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/authHelpers";
import {
  fetchForecastRows,
  parseForecastFilter,
} from "@/lib/forecastAnalytics";

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const { filter, error } = parseForecastFilter(searchParams);

  if (error !== null) {
    return NextResponse.json({ status: false, message: error }, { status: 400 });
  }

  try {
    const supabase = await getSupabaseServerClient();
    const rows = await fetchForecastRows(supabase, filter);

    return NextResponse.json({
      status: true,
      message: "Prognosdata hämtad",
      data: rows,
    });
  } catch (fetchError) {
    console.error("analytics/forecasts error:", fetchError);
    return NextResponse.json(
      {
        status: false,
        message:
          fetchError instanceof Error
            ? fetchError.message
            : "Kunde inte hämta prognosdata",
      },
      { status: 500 },
    );
  }
}
