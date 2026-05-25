/**
 * GET /api/ilog/consignment
 * 
 * Hämtar full detalj för en enskild bokning (consignment) från iLog.
 * Frontend anropar denna när användare klickar på en bokning i listan.
 * 
 * Required query params:
 *   - consignmentId (integer): ID från consignmentlistan
 * 
 * Optional query params:
 *   - includeHistory=true|false (default: false) → ask iLog for booking history
 *   - includeEvents=true|false (default: false) → ask iLog for tracked events
 *   - debugRaw=true → returnera rå JSON från iLog (utan mapping)
 *   
 * Response: { status, message, data: ConsignmentDetail }
 * 
 * Validering:
 *   - Returnerar 400 om consignmentId saknas eller inte är heltal
 * 
 * Felhantering:
 *   - 502: iLog är inte nåbar eller svarar 401
 *   - 500: Annat serverfel
 */

import { NextResponse } from "next/server";
import { ilogGet, IlogHttpError } from "@/lib/ilogClient";
import { mapConsignmentDetail } from "@/lib/ilogMappers";

// Hjälpfunktion för boolean query-parametrar.
const parseBoolean = (value: string | null, defaultValue: boolean): boolean => {
  if (value === null) {
    return defaultValue;
  }

  // Endast "true" blir true, allt annat blir false.
  return value.toLowerCase() === "true";
};

// GET /api/ilog/consignment?consignmentId=123
// Optional: includeHistory=true|false, includeEvents=true|false, debugRaw=true
export async function GET(request: Request) {
  // Plockar query-parametrar från URL.
  const { searchParams } = new URL(request.url);
  const debugRaw = process.env.NODE_ENV !== "production" && searchParams.get("debugRaw") === "true";

  const consignmentId = searchParams.get("consignmentId");

  // Krav: consignmentId måste vara heltal.
  if (!consignmentId || !/^\d+$/.test(consignmentId)) {
    return NextResponse.json(
      {
        status: false,
        message: "Invalid or missing consignmentId. Expected an integer",
      },
      { status: 400 }
    );
  }

  // Optionala flaggor med sensibla defaults (false = inte include).
  const includeHistory = parseBoolean(searchParams.get("includeHistory"), false);
  const includeEvents = parseBoolean(searchParams.get("includeEvents"), false);

  try {
    // Externt iLog-anrop för bokningsdetaljer.
    const rawConsignment = await ilogGet<unknown>("/ilog-api-web/consignment", {
      consignmentId,
      includeHistory,
      includeEvents,
    });

    if (debugRaw) {
      return NextResponse.json({
        status: true,
        message: "Raw consignment fetched",
        data: rawConsignment,
      });
    }

    // Mappa från iLog's komplexa struktur till typ-säkert detalj-objekt
    const consignment = mapConsignmentDetail(rawConsignment);

    // Returnerar data till frontend.
    return NextResponse.json({
      status: true,
      message: "Consignment fetched",
      data: consignment,
    });
  } catch (error) {
    // Kända iLog-relaterade fel.
    if (error instanceof IlogHttpError) {
      return NextResponse.json(
        { status: false, message: error.message },
        { status: error.status }
      );
    }

    // Okända serverfel.
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
