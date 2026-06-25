import { NextRequest, NextResponse } from "next/server";
import { routeConsignment } from "@/profitability/service";
import { ConsignmentListItem } from "@/lib/ilogTypes";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/authHelpers";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/lib/supabaseServerSchema";

function cleanTaxPoint(value: string | null | undefined): string {
  return (value ?? "").replace(/[^0-9]/g, "");
}

function normalizeCity(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

function splitTaxPointRelation(
  taxPointRelation: string,
): {
  senderTaxPoint: string | null;
  receiverTaxPoint: string | null;
} {
  const parts = taxPointRelation
    .split("-")
    .map((part) => cleanTaxPoint(part))
    .filter(Boolean);

  return {
    senderTaxPoint: parts[0] ?? null,
    receiverTaxPoint: parts[1] ?? null,
  };
}

/**
 * Hämtar taxepunkt från tax_point_lookup.
 *
 * Först testas postnummer. Om postnummer saknas eller inte ger träff
 * används postort som fallback.
 */
async function resolveTaxPoint(
  supabase: SupabaseClient<Database>,
  postalCode: string,
  city: string,
): Promise<string> {
  const zipClean = postalCode.replace(/[\s-]/g, "");
  const normalizedCity = normalizeCity(city);

  if (zipClean) {
    const zipNumber = parseInt(zipClean, 10);

    if (!Number.isNaN(zipNumber)) {
      const { data } = await supabase
        .from("tax_point_lookup")
        .select("taxepunktspostnummer")
        .eq("postnummer", zipNumber)
        .maybeSingle();

      if (data?.taxepunktspostnummer) {
        return data.taxepunktspostnummer.toString();
      }
    }
  }

  if (normalizedCity) {
    const { data } = await supabase
      .from("tax_point_lookup")
      .select("taxepunktspostnummer")
      .ilike("postort", normalizedCity)
      .limit(1);

    if (data?.[0]?.taxepunktspostnummer) {
      return data[0].taxepunktspostnummer.toString();
    }
  }

  return "";
}

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

    const supabase = await getSupabaseServerClient();

    // 1. Kolla upp mottagarens taxepunkt.
    const destinationTaxPoint = await resolveTaxPoint(
      supabase,
      consignment.destinationPostalCode || "",
      consignment.destinationCity || "",
    );

    const isValidDest = Boolean(destinationTaxPoint);

    // 2. Bygg taxPointRelation om den saknas.
    let finalTaxPointRelation = consignment.taxPointRelation || "";

    let senderTaxPoint: string | null = null;
    let receiverTaxPoint: string | null = null;

    if (finalTaxPointRelation) {
      const splitResult = splitTaxPointRelation(finalTaxPointRelation);

      senderTaxPoint = splitResult.senderTaxPoint;
      receiverTaxPoint = splitResult.receiverTaxPoint;
    }

    // Om relationen saknas eller är ofullständig hämtas taxepunkter
    // via postnummer, med postort som fallback.
    if (!senderTaxPoint) {
      senderTaxPoint =
        (await resolveTaxPoint(
          supabase,
          consignment.pickupPostalCode || "",
          consignment.pickupLocationCity || "",
        )) || null;
    }

    if (!receiverTaxPoint) {
      receiverTaxPoint = destinationTaxPoint || null;
    }

    if (!finalTaxPointRelation && senderTaxPoint && receiverTaxPoint) {
      finalTaxPointRelation = `${senderTaxPoint}-${receiverTaxPoint}`;
    }

    // 3. Skicka vidare.
    const enrichedConsignment = {
      ...consignment,
      taxPointRelation: finalTaxPointRelation,
      _isDbValidDestination: isValidDest,
    } as ConsignmentListItem & {
      _isDbValidDestination: boolean;
    };


    const input = {
      kundnamn: enrichedConsignment.customerName,
      taxPointRelation: finalTaxPointRelation,
      chargeable_weight: enrichedConsignment.weight ?? 0,

      // Tilläggslogiken använder enskilda taxepunkter.
      senderTaxPoint,
      receiverTaxPoint,

      // Fallback i addons_postal om taxepunkt inte hittas.
      pickupCity: enrichedConsignment.pickupLocationCity || null,
      destinationCity: enrichedConsignment.destinationCity || null,
    };

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