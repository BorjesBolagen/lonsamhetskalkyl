/**
 * GET /api/ilog/equipages
 * 
 * Hämtar lista över ekipage (fordon/transport-enheter) från iLog.
 * 
 * Frontend anropar denna via getIlogEquipages() för dropdowns och listor.
 * 
 * Query params:
 *   - ?debugRaw=true → returnera rå JSON från iLog (utan mapping)
 *   
 * Response: { status, message, data: EquipageItem[] }
 *   Exempel:
 *   [
 *     { id: 8943, name: "B06" },
 *     { id: 7862, name: "B07" }
 *   ]
 * 
 * Felhantering:
 *   - 502: iLog är inte nåbar eller svarar 401
 *   - 500: Annat serverfel
 */

import { NextResponse } from "next/server";
import { ilogGet, IlogHttpError } from "@/lib/ilogClient";
import { mapEquipages } from "@/lib/ilogMappers";

// GET /api/ilog/equipages
// Optional: debugRaw=true
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const debugRaw = process.env.NODE_ENV !== "production" && searchParams.get("debugRaw") === "true";

    // Externt iLog-anrop: hämta ekipage i användarens grupp.
    const rawEquipages = await ilogGet<unknown[]>("/ilog-api-web/driver/equipages");

    // Vid felsokning kan man be om rådata direkt från iLog.
    if (debugRaw) {
      return NextResponse.json({
        status: true,
        message: "Raw equipages fetched",
        data: rawEquipages,
      });
    }

    // Mappa från iLog's format till rena TypeScript-objekt
    const equipages = mapEquipages(rawEquipages);

    // Svar till frontend i ett enhetligt format.
    return NextResponse.json({
      status: true,
      message: "Equipages fetched",
      data: equipages,
    });
  } catch (error) {
    // Kända iLog-fel -> returnera den status vi redan mappar i klienten.
    if (error instanceof IlogHttpError) {
      return NextResponse.json(
        { status: false, message: error.message },
        { status: error.status }
      );
    }

    // Okändt fel -> generiskt 500-fel.
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
