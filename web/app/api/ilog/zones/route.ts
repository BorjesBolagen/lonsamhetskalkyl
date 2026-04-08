import { NextResponse } from "next/server";
import { ilogGet, IlogHttpError } from "@/lib/ilogClient";
import { mapZones } from "@/lib/ilogMappers";

const DATE_REGEX = /^\d{8}$/;

const parseBoolean = (value: string | null, defaultValue: boolean): boolean => {
  if (value === null) {
    return defaultValue;
  }

  return value.toLowerCase() === "true";
};

// GET /api/ilog/zones?date=yyyyMMdd&withEquipages=true|false
// Optional: debugRaw=true
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const debugRaw = searchParams.get("debugRaw") === "true";

  const date = searchParams.get("date");
  if (!date || !DATE_REGEX.test(date)) {
    return NextResponse.json(
      {
        status: false,
        message: "Invalid or missing date. Expected format yyyyMMdd",
      },
      { status: 400 }
    );
  }

  const withEquipages = parseBoolean(searchParams.get("withEquipages"), true);

  try {
    const rawZones = await ilogGet<unknown>("/ilog-api-web/zones", {
      date,
      withEquipages,
    });

    if (debugRaw) {
      return NextResponse.json({
        status: true,
        message: "Raw zones fetched",
        data: rawZones,
      });
    }

    const zones = mapZones(rawZones);

    return NextResponse.json({
      status: true,
      message: "Zones fetched",
      data: zones,
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
