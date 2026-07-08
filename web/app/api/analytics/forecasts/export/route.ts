/**
 * GET /api/analytics/forecasts/export
 *
 * Laddar ner sparade nattprognoser som Excel-fil (.xlsx). Endast admin.
 * Samma filter som /api/analytics/forecasts:
 *   - from (YYYY-MM-DD, krävs)
 *   - to (YYYY-MM-DD, krävs)
 *   - equipageIds (valfri, kommaseparerad lista av ekipage-id)
 *
 * Response: xlsx-fil med en rad per ekipage och datum + summeringsrad.
 */

import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
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

    const workbook = new ExcelJS.Workbook();
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Prognoser");
    sheet.columns = [
      { header: "Datum", key: "date", width: 12 },
      { header: "Ekipage", key: "equipage", width: 20 },
      { header: "Total vikt (kg)", key: "weight", width: 16 },
      { header: "Total flakmeter", key: "flm", width: 16 },
      { header: "Prognostiserad intäkt (SEK)", key: "revenue", width: 26 },
      { header: "Antal bokningar", key: "count", width: 16 },
    ];
    sheet.getRow(1).font = { bold: true };

    for (const row of rows) {
      sheet.addRow({
        date: row.forecast_date,
        equipage: row.equipage_name,
        weight: Number(row.total_weight_kg),
        flm: Number(row.total_flm),
        revenue: Number(row.total_estimated_revenue),
        count: row.consignment_count,
      });
    }

    if (rows.length > 0) {
      const totalRow = sheet.addRow({
        date: "Totalt",
        equipage: "",
        weight: rows.reduce((sum, row) => sum + Number(row.total_weight_kg), 0),
        flm: rows.reduce((sum, row) => sum + Number(row.total_flm), 0),
        revenue: rows.reduce(
          (sum, row) => sum + Number(row.total_estimated_revenue),
          0,
        ),
        count: rows.reduce((sum, row) => sum + row.consignment_count, 0),
      });
      totalRow.font = { bold: true };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `prognoser_${filter.from}_${filter.to}.xlsx`;

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (exportError) {
    console.error("analytics/forecasts/export error:", exportError);
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
