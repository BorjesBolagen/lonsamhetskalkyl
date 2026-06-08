import { NextRequest, NextResponse } from "next/server";
import { calculateProfitability } from "@/profitability/service";

export async function GET(req: NextRequest) {
  try {

    const { searchParams } = new URL(req.url);
    const kundnamn = searchParams.get("kundnamn");
    const taxPointRelation = searchParams.get("taxPointRelation");
    const chargeable_weight = searchParams.get("chargeable_weight");

    if (!kundnamn || !taxPointRelation || !chargeable_weight) {
      return NextResponse.json({
        success: false,
        error: "Inget kundnamn, taxepunktsrelation eller vikt angiven"
      });
    }

    if (isNaN(Number(chargeable_weight))) {
      return NextResponse.json({
        success: false,
        error: "Angiven vikt är inte ett nummer"
      });
    }
    
    console.log("Test");
    const result = await calculateProfitability({
      kundnamn: kundnamn,
      taxPointRelation: taxPointRelation,
      chargeable_weight: Number(chargeable_weight),
    });

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