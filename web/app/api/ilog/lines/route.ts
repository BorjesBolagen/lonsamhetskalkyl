import { NextResponse } from "next/server";
import { ilogGet, IlogHttpError } from "@/lib/ilogClient";
import { mapLines } from "@/lib/ilogMappers";
import { requireUser } from "@/lib/authHelpers";

// GET /api/ilog/lines
// Optional: debugRaw=true
export async function GET(request: Request) {

  const { error } = await requireUser();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const debugRaw = process.env.NODE_ENV !== "production" && searchParams.get("debugRaw") === "true";

    // Externt iLog-anrop: hämta alla linjer for aktuell grupp.
    const rawLines = await ilogGet<unknown[]>("/ilog-api-web/lines");

    // Vid felsökning kan man be om rådata direkt från iLog.
    if (debugRaw) {
      return NextResponse.json({
        status: true,
        message: "Raw lines fetched",
        data: rawLines,
      });
    }

    const lines = mapLines(rawLines);

    return NextResponse.json({
      status: true,
      message: "Lines fetched",
      data: lines,
    });
  } catch (error) {
    if (error instanceof IlogHttpError) {
      return NextResponse.json(
        { status: false, message: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
