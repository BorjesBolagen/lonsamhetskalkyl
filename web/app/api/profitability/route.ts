import { NextRequest, NextResponse } from "next/server";
// Byt ut importen så att vi hämtar vår nya router-funktion istället
import { routeConsignment } from "@/profitability/service"; 
import { ConsignmentListItem } from "@/lib/ilogTypes";

export async function POST(req: NextRequest) {
  try {
    // 1. Ta emot hela iLog-objektet från frontend
    const body = await req.json();
    const consignment = body.consignment as ConsignmentListItem;

    if (!consignment) {
      return NextResponse.json({
        success: false,
        error: "Ingen sändningsdata skickades med.",
      });
    }

    // 2. Bygg det gamla 'input'-objektet (för säkerhets skull, om det blir ett trappstegs-anrop)
    const input = {
      kundnamn: consignment.customerName || "",
      taxPointRelation: consignment.taxPointRelation || "",
      chargeable_weight: Number(consignment.weight || 0),
    };

    if (isNaN(input.chargeable_weight)) {
      return NextResponse.json({
        success: false,
        error: "Angiven vikt är inte ett nummer",
      });
    }

    // 3. Skicka in allt i Växeln (som du nyss byggde i service.ts)
    const result = await routeConsignment(consignment, input);

    return NextResponse.json({
      success: true,
      value: result,
    });
  } catch (error) {
    console.error("profitability route error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Okänt fel vid lönsamhetsberäkning.",
      },
      { status: 500 }
    );
  }
}