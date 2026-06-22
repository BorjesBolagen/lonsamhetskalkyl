/**
 * GET /api/ilog/consignments
 * 
 * Hämtar bokningar (consignments) för ett ekipage på ett givet datum från iLog.
 * Frontend anropar denna efter att ha valt ekipage + datum för att visa lista.
 * 
 * Required query params:
 *   - date (string): Datumformat yyyyMMdd (t.ex. "20260331")
 *   - equipageId (integer): ID från ekipageslistan
 * 
 * Optional:
 *   - debugRaw=true → returnera rå JSON från iLog (utan mapping)
 *   
 * Response: { status, message, data: ConsignmentListItem[] }
 * 
 * Validering:
 *   - Returnerar 400 om date saknas eller har fel format
 *   - Returnerar 400 om equipageId saknas eller inte är heltal
 * 
 * Felhantering:
 *   - 502: iLog är inte nåbar eller svarar 401
 *   - 500: Annat serverfel
 * 
 * Mapping steg:
 *   1. Hämta rå data från iLog
 *   2. Hunt för consignment-objekt i nested struktur (collectConsignmentCandidates)
 *   3. Extrahera relevanta fält för var consignment
 *   4. Filter bort helt tomma entries
 */

import { NextResponse } from "next/server";
import { ilogGet, IlogHttpError } from "@/lib/ilogClient";
import { mapConsignments } from "@/lib/ilogMappers";
import { enrichTaxPointRelationFromSupabase } from "@/lib/taxPointLookup";

// yyyyMMdd format
const DATE_REGEX = /^\d{8}$/;

// GET /api/ilog/consignments?date=yyyyMMdd&equipageId=123
export async function GET(request: Request) {
  // Plockar query-parametrar från URL.
  const { searchParams } = new URL(request.url);
  const debugRaw = searchParams.get("debugRaw") === "true";

  const date = searchParams.get("date");
  const equipageId = searchParams.get("equipageId");

  // Enkel validering av datumformat, så vi stoppar trasiga anrop tidigt.
  if (!date || !DATE_REGEX.test(date)) {
    return NextResponse.json(
      {
        status: false,
        message: "Invalid or missing date. Expected format yyyyMMdd",
      },
      { status: 400 }
    );
  }

  // equipageId måste vara heltal.
  if (!equipageId || !/^\d+$/.test(equipageId)) {
    return NextResponse.json(
      {
        status: false,
        message: "Invalid or missing equipageId. Expected an integer",
      },
      { status: 400 }
    );
  }

  try {
    // Externt iLog-anrop med date + equipageId.
    const rawConsignments = await ilogGet<unknown>("/ilog-api-web/equipage/consignments", {
      date,
      equipageId,
      minified: "false", // Gör så iLog skickar med fakturastatus och pris
    });

    if (debugRaw) {
      return NextResponse.json({
        status: true,
        message: "Raw consignments fetched",
        data: rawConsignments,
      });
    }

    // Mappa från iLog's komplexa nested struktur till rena DTO:er
    const consignments = mapConsignments(rawConsignments);
    const consignmentsWithTaxPointRelation =
      await enrichTaxPointRelationFromSupabase(consignments);

    // Returnerar datan till frontend.
    return NextResponse.json({
      status: true,
      message: "Consignments fetched",
      data: consignmentsWithTaxPointRelation,
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
