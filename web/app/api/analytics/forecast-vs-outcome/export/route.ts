/**
 * GET /api/analytics/forecast-vs-outcome/export?month=YYYY-MM
 *
 * Laddar ner jämförelsen utfall/prognos per regnr som Excel-fil. Endast admin.
 */

import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
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

    const workbook = new ExcelJS.Workbook();
    workbook.created = new Date();
    const sheet = workbook.addWorksheet("Prognos vs utfall");
    sheet.columns = [
      { header: "Namn", key: "name", width: 20 },
      { header: "Regnr", key: "regnr", width: 12 },
      { header: "Utfall (SEK)", key: "outcome", width: 16 },
      { header: "Prognos (SEK)", key: "forecast", width: 16 },
      { header: "Diff (SEK)", key: "diff", width: 16 },
      { header: "Diff %", key: "diffPercent", width: 10 },
      { header: "Dagar med prognos", key: "days", width: 18 },
    ];
    sheet.getRow(1).font = { bold: true };

    for (const row of rows) {
      sheet.addRow({
        name: row.equipageName ?? "",
        regnr: row.regnr,
        outcome: row.outcome,
        forecast: row.forecast,
        diff: row.diff,
        diffPercent: row.diffPercent === null ? null : row.diffPercent / 100,
        days: row.forecastDays,
      });
    }
    sheet.getColumn("diffPercent").numFmt = "0.0%";

    if (rows.length > 0) {
      const outcome = rows.reduce((sum, r) => sum + (r.outcome ?? 0), 0);
      const forecast = rows.reduce((sum, r) => sum + (r.forecast ?? 0), 0);
      const total = sheet.addRow({
        name: "Totalt",
        outcome,
        forecast,
        diff: outcome - forecast,
        diffPercent: forecast ? (outcome - forecast) / forecast : null,
      });
      total.font = { bold: true };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="prognos_vs_utfall_${month}.xlsx"`,
      },
    });
  } catch (exportError) {
    console.error("analytics/forecast-vs-outcome/export error:", exportError);
    return NextResponse.json(
      {
        status: false,
        message:
          exportError instanceof Error
            ? exportError.message
            : "Kunde inte skapa Excel-fil",
      },
      { status: 500 },
    );
  }
}
