import { NextResponse } from "next/server";
import { ilogGet, IlogHttpError } from "@/lib/ilogClient";
import { mapConsignments } from "@/lib/ilogMappers";
import { requireUser } from "@/lib/authHelpers";
import {
  getIlogEndpoint,
  LINE_TYPES,
  type SupportedLineType,
} from "@/lib/ilogLineEndpoints";

const DATE_REGEX = /^\d{8}$/;

/**
 * GET /api/ilog/line-consignments
 *
 * Hämtar *alla* bokningar på en linje för ett datum, både placerade och oplacerade.
 *
 * Home använder den i "Nytt linjeval" för att låta bokningarna peka ut vilka bilar som
 * hör till linjen, i stället för att utgå från ekipagets linjetagg i iLog.
 *
 * Skiljer sig från /api/ilog/unassigned-consignments, som filtrerar bort bokningar med
 * ekipage och enrichar taxPointRelation för simulatorn. Här behövs bara ekipage och
 * linje - bilens fulla bokningslista hämtas ändå per ekipage.
 *
 * Query params:
 *   - date (yyyyMMdd), lineId (heltal), lineType (ZONE | ZONEFILTER | ZONEGROUP)
 *   - ?debugRaw=true → rå JSON från iLog (endast utanför produktion)
 */
export async function GET(request: Request) {
  const { error } = await requireUser();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const debugRaw =
    process.env.NODE_ENV !== "production" &&
    searchParams.get("debugRaw") === "true";

  const date = searchParams.get("date");
  const lineId = searchParams.get("lineId");
  const lineTypeRaw = searchParams.get("lineType")?.toUpperCase() ?? "";

  if (!date || !DATE_REGEX.test(date)) {
    return NextResponse.json(
      {
        status: false,
        message: "Invalid or missing date. Expected format yyyyMMdd",
      },
      { status: 400 },
    );
  }

  if (!lineId || !/^\d+$/.test(lineId)) {
    return NextResponse.json(
      {
        status: false,
        message: "Invalid or missing lineId. Expected an integer",
      },
      { status: 400 },
    );
  }

  if (!LINE_TYPES.has(lineTypeRaw)) {
    return NextResponse.json(
      {
        status: false,
        message:
          "Invalid or missing lineType. Expected ZONE, ZONEFILTER or ZONEGROUP.",
      },
      { status: 400 },
    );
  }

  const lineType = lineTypeRaw as SupportedLineType;
  const { path, query } = getIlogEndpoint(lineType, lineId);

  try {
    const rawConsignments = await ilogGet<unknown>(path, {
      date,
      ...query,
    });

    if (debugRaw) {
      return NextResponse.json({
        status: true,
        message: "Raw consignments fetched",
        data: rawConsignments,
      });
    }

    return NextResponse.json({
      status: true,
      message: "Line consignments fetched",
      data: mapConsignments(rawConsignments),
    });
  } catch (error) {
    if (error instanceof IlogHttpError) {
      return NextResponse.json(
        { status: false, message: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
