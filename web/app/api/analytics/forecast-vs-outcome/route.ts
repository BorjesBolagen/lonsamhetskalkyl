/**
 * GET /api/analytics/forecast-vs-outcome?month=YYYY-MM
 *
 * Jämför importerat utfall mot summerad nattprognos per regnr för en månad.
 * Endast admin.
 *
 * Response: { status, message, data: { rows, daysInMonth } }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/authHelpers";
import { fetchForecastVsOutcome } from "@/lib/forecastVsOutcome";

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const month = new URL(request.url).searchParams.get("month") ?? "";
  if (!MONTH_REGEX.test(month)) {
    return NextResponse.json(
      { status: false, message: "month krävs i formatet YYYY-MM" },
      { status: 400 },
    );
  }

  try {
    const supabase = await getSupabaseServerClient();
    const rows = await fetchForecastVsOutcome(supabase, month);
    const [year, monthNumber] = month.split("-").map(Number);
    const daysInMonth = new Date(year, monthNumber, 0).getDate();

    return NextResponse.json({
      status: true,
      message: "Jämförelse hämtad",
      data: { rows, daysInMonth },
    });
  } catch (fetchError) {
    console.error("analytics/forecast-vs-outcome error:", fetchError);
    return NextResponse.json(
      {
        status: false,
        message:
          fetchError instanceof Error
            ? fetchError.message
            : "Kunde inte hämta jämförelsen",
      },
      { status: 500 },
    );
  }
}
