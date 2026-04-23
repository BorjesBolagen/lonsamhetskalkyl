import { NextRequest, NextResponse } from "next/server";
import { calculateProfitability } from "@/profitability/service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const result = await calculateProfitability({
      kundnamn: body.kundnamn,
      taxPointRelation: body.taxPointRelation,
      chargeable_weight: body.chargeable_weight,
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