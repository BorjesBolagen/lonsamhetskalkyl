import { NextRequest, NextResponse } from "next/server";
import { routeConsignment } from "@/profitability/service";
import { ConsignmentListItem } from "@/lib/ilogTypes";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { prepareProfitabilityRequest } from "@/lib/profitabilityInput";
import { requireUser } from "@/lib/authHelpers";

export async function GET(req: NextRequest) {

  const { error: userError } = await requireUser();
  if (userError) return userError;

  try {
    const { searchParams } = new URL(req.url);

    const consignment = {
      consignmentId: Number(searchParams.get("consignmentId")) || 0,
      customerName: searchParams.get("customerName") || "",
      destinationCity: searchParams.get("destinationCity") || "",
      senderName: searchParams.get("senderName") || "",
      pickupLocationName: searchParams.get("pickupLocationName") || "",
      receiverName: searchParams.get("receiverName") || "",
      destinationLocationName:
        searchParams.get("destinationLocationName") || "",
      weight: Number(searchParams.get("weight")) || 0,
      zoneName: searchParams.get("zoneName") || "",
      consignmentProperties: searchParams.get("consignmentProperties") || "",
      pickupLocationCity: searchParams.get("pickupLocationCity") || "",
      taxPointRelation: searchParams.get("taxPointRelation") || "",
      pickupPostalCode: searchParams.get("pickupPostalCode") || "",
      destinationPostalCode: searchParams.get("destinationPostalCode") || "",
      invoiceStatus: searchParams.get("invoiceStatus") || "",
      internalPrice: Number(searchParams.get("internalPrice")) || 0,
      paketburar: Number(searchParams.get("paketburar")) || 0,
    } as ConsignmentListItem;

    const lineRelation =
      searchParams.get("linjerel")
      || searchParams.get("lineRelation")
      || consignment.zoneName
      || null;

    const supabase = await getSupabaseServerClient();

    // Berikning (taxepunkter) + input-bygge delas med nattliga prognosjobbet.
    const { enrichedConsignment, input } = await prepareProfitabilityRequest(
      supabase,
      consignment,
    );

    const result = await routeConsignment(
      enrichedConsignment,
      input,
    );

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
      {
        status: 500,
      },
    );
  }
}
