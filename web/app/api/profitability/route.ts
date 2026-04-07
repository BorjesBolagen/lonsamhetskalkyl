import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const backendUrl =
      process.env.CALCULATION_SERVICE_URL ||
      "http://127.0.0.1:8000/profitability/steps-1-3";

    const response = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      const text = await response.text();
      return NextResponse.json(
        {
          success: false,
          error: "Beräkningsmotorn returnerade inte JSON.",
          raw: text,
        },
        { status: 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Okänt fel vid anrop till beräkningsmotorn.",
      },
      { status: 500 }
    );
  }
}