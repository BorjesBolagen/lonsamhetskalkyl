import { NextResponse } from "next/server";
import { ilogGet, IlogHttpError } from "@/lib/ilogClient";
import { mapConsignments } from "@/lib/ilogMappers";
import { enrichTaxPointRelationFromSupabase } from "@/lib/taxPointLookup";
import type { ConsignmentListItem } from "@/lib/ilogTypes";

const DATE_REGEX = /^\d{8}$/;
const LINE_TYPES = new Set(["ZONE", "ZONEFILTER", "ZONEGROUP"]);

type SupportedLineType = "ZONE" | "ZONEFILTER" | "ZONEGROUP";

/**
 * Returnerar rätt iLog-endpoint beroende på linjetyp.
 */
function getIlogEndpoint(lineType: SupportedLineType, lineId: string) {
  switch (lineType) {
    case "ZONE":
      return {
        path: "/ilog-api-web/zone/consignments",
        query: { zoneId: lineId },
      };

    case "ZONEFILTER":
      return {
        path: "/ilog-api-web/zonefilter/consignments",
        query: { zoneFilterId: lineId },
      };

    case "ZONEGROUP":
      return {
        path: "/ilog-api-web/zonegroup/consignments",
        query: { zoneGroupId: lineId },
      };
  }
}

/**
 * Bokningen räknas som oplacerad om den saknar ekipage.
 */
function isUnassignedConsignment(consignment: ConsignmentListItem): boolean {
  return (consignment.equipageName?.trim() ?? "").length === 0;
}

/**
 * GET /api/ilog/unassigned-consignments
 *
 * Hämtar bokningar på vald linje, filtrerar oplacerade och enrichar taxPointRelation.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const debugRaw = process.env.NODE_ENV !== "production" && searchParams.get("debugRaw") === "true";

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

    const consignments = mapConsignments(rawConsignments);
    const unassignedConsignments = consignments.filter(isUnassignedConsignment);

    // Viktigt: lägger till taxPointRelation från Supabase.
    const enrichedConsignments =
      await enrichTaxPointRelationFromSupabase(unassignedConsignments);

    return NextResponse.json({
      status: true,
      message: "Unassigned consignments fetched",
      data: enrichedConsignments,
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