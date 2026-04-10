import { NextRequest, NextResponse } from "next/server";
import { calculateSimulationProfitability } from "@/profitability_simulation/service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const result = await calculateSimulationProfitability({
      kundnamn: body.kundnamn,
      start: body.start,
      slut: body.slut,
      chargeable_weight: body.chargeable_weight,
    });

    return NextResponse.json({
      success: true,
      value: result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Okänt fel vid simuleringens lönsamhetsberäkning.",
      },
      { status: 500 }
    );
  }
}