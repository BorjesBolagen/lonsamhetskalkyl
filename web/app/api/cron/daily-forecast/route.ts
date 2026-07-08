/**
 * GET /api/cron/daily-forecast
 *
 * Nattligt cron-jobb (Vercel Cron, se vercel.json) som prognostiserar
 * samtliga ekipage för datumet 2 dagar bakåt och sparar resultatet i
 * daily_equipage_forecast. Körs 00:00 svensk tid.
 *
 * Säkerhet: kräver header "Authorization: Bearer <CRON_SECRET>".
 * Vercel Cron skickar denna automatiskt när env-variabeln CRON_SECRET är satt.
 *
 * Query params (valfria):
 *   - date=YYYY-MM-DD  → kör för ett specifikt datum (backfill/omkörning).
 *                        Utan param används idag (Europe/Stockholm) minus 2 dagar.
 *
 * Response: { status, message, summary }
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getStockholmDateDaysBack,
  runDailyEquipageForecast,
} from "@/lib/forecastEngine";
import { IlogHttpError } from "@/lib/ilogClient";

// Prognosen gör många iLog- och databasanrop; höj tidsgränsen (Vercel).
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DAYS_BACK = 2;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET är inte satt; cron-jobbet kan inte köras.");
    return NextResponse.json(
      { status: false, message: "CRON_SECRET saknas i miljön" },
      { status: 500 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { status: false, message: "Ej autentiserad" },
      { status: 401 },
    );
  }

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

    console.log(
      `Daglig prognos klar för ${forecastDate}: ` +
        `${summary.rowsSaved} ekipage sparade, ` +
        `${summary.consignmentsProcessed} bokningar, ` +
        `${summary.failures.length} fel.`,
    );

    return NextResponse.json({
      status: true,
      message: `Prognos sparad för ${forecastDate}`,
      summary,
    });
  } catch (error) {
    console.error("Daglig prognos misslyckades:", error);

    if (error instanceof IlogHttpError) {
      return NextResponse.json(
        { status: false, message: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        status: false,
        message:
          error instanceof Error ? error.message : "Okänt fel i prognosjobbet",
      },
      { status: 500 },
    );
  }
}
