/**
 * GET /api/cron/manual-daily-forecast
 *
 * Manuell test-trigger för det nattliga prognosjobbet. Endast admin.
 * Använder samma prognosmotor som /api/cron/daily-forecast,
 * men behöver inte CRON_SECRET eftersom den kallas från en inloggad admin.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authHelpers";
import {
  getStockholmDateDaysBack,
  runDailyEquipageForecast,
} from "@/lib/forecastEngine";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DAYS_BACK = 7;

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  console.log("gets in here");
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");

  if (dateParam && !DATE_REGEX.test(dateParam)) {
    return NextResponse.json(
      { status: false, message: "Ogiltigt datum. Förväntat format YYYY-MM-DD" },
      { status: 400 },
    );
  }

  const forecastDate = dateParam ?? getStockholmDateDaysBack(DAYS_BACK);

  try {
    const summary = await runDailyEquipageForecast(forecastDate);

    return NextResponse.json({
      status: true,
      message: `Prognos sparad för ${forecastDate}`,
      summary,
    });
  } catch (error) {
    console.error("Manuell prognos misslyckades:", error);

    return NextResponse.json(
      {
        status: false,
        message:
          error instanceof Error
            ? error.message
            : "Okänt fel i prognosjobbet",
      },
      { status: 500 },
    );
  }
}
