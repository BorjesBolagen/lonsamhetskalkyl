/**
 * POST /api/analytics/outcome/import  (multipart/form-data, endast admin)
 *
 * Fält:
 *   - file: .xlsx med regnr i kolumn A och total intäkt i kolumn B
 *   - month: YYYY-MM som utfallet gäller
 *   - mode: "preview" (default, skriver inget) eller "commit"
 *
 * Commit ersätter hela månadens utfall i en transaktion.
 */

import { NextResponse } from "next/server";
import {
  getSupabaseAdminClient,
  getSupabaseServerClient,
} from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/authHelpers";
import { fetchForecastVsOutcome } from "@/lib/forecastVsOutcome";
import { MONTH_REGEX, parseOutcomeWorkbook } from "@/lib/outcomeImport";

const MAX_FILE_BYTES = 4 * 1024 * 1024;

function fail(message: string, status = 400) {
  return NextResponse.json({ status: false, message }, { status });
}

export async function POST(request: Request) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const form = await request.formData();
    const file = form.get("file");
    const month = String(form.get("month") ?? "");
    const mode = form.get("mode") === "commit" ? "commit" : "preview";

    if (!MONTH_REGEX.test(month)) return fail("month krävs i formatet YYYY-MM");
    if (!(file instanceof File)) return fail("Ingen fil bifogad.");
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return fail("Välj en .xlsx-fil.");
    }
    if (file.size > MAX_FILE_BYTES) return fail("Filen är för stor (max 4 MB).");

    const parsed = await parseOutcomeWorkbook(await file.arrayBuffer());
    if (parsed.errors.length > 0) {
      return NextResponse.json(
        {
          status: false,
          message: "Filen innehåller ogiltiga rader.",
          errors: parsed.errors.slice(0, 50),
        },
        { status: 400 },
      );
    }
    if (parsed.rows.length === 0) return fail("Filen innehåller inga rader.");

    const supabase = await getSupabaseServerClient();
    const admin = getSupabaseAdminClient();
    const monthStart = `${month}-01`;

    if (mode === "commit") {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await admin.rpc("replace_monthly_equipage_outcome", {
        p_month: monthStart,
        p_rows: parsed.rows,
        p_file_name: file.name,
        p_imported_by: userData.user!.id,
      });
      if (error) return fail(`Kunde inte spara utfallet: ${error.message}`, 500);

      return NextResponse.json({
        status: true,
        message: `Utfall sparat för ${month}`,
        data: { savedRows: data },
      });
    }

    // Förhandsvisning: jämför mot prognosen och mot redan importerat utfall.
    const comparison = await fetchForecastVsOutcome(supabase, month);
    const forecastRegnr = new Set(
      comparison.filter((r) => r.forecast !== null).map((r) => r.regnr),
    );
    const existingRows = comparison.filter((r) => r.outcome !== null).length;

    return NextResponse.json({
      status: true,
      message: "Förhandsvisning",
      data: {
        rowCount: parsed.rows.length,
        totalRevenue: parsed.rows.reduce((sum, r) => sum + r.revenue, 0),
        duplicateRegnr: parsed.duplicateRegnr,
        regnrWithoutForecast: parsed.rows
          .map((r) => r.regnr)
          .filter((regnr) => !forecastRegnr.has(regnr)),
        existingRowsForMonth: existingRows,
      },
    });
  } catch (importError) {
    console.error("analytics/outcome/import error:", importError);
    return fail(
      importError instanceof Error ? importError.message : "Importen misslyckades",
      500,
    );
  }
}
