import { NextRequest, NextResponse } from "next/server";
import { routeConsignment } from "@/profitability/service";
import { ConsignmentListItem } from "@/lib/ilogTypes";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import type { ProfitabilityInput } from "@/profitability/types";

function parseBooleanParam(value: string | null): boolean {
  return value === "true" || value === "1";
}
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
async function resolveTaxPoints(
  supabase: SupabaseClient<Database>,
  lookups: { postalCode: string; city: string }[],
): Promise<string[]> {
  const zipNumbers = lookups
    .map((l) => parseInt(l.postalCode.replace(/[\s-]/g, ""), 10))
    .filter((n) => !Number.isNaN(n));

  const cities = lookups
    .map((l) => normalizeCity(l.city))
    .filter(Boolean);

  // Single query fetching all relevant rows
  const { data } = await supabase
    .from("tax_point_lookup")
    .select("postnummer, postort, taxepunktspostnummer")
    .or(
      [
        zipNumbers.length ? `postnummer.in.(${zipNumbers.join(",")})` : null,
        cities.length ? cities.map(c => `postort.ilike.${c}`).join(",") : null,
      ].filter(Boolean).join(",")
    );

  const rows = data ?? [];

  return lookups.map(({ postalCode, city }) => {
    const zipNumber = parseInt(postalCode.replace(/[\s-]/g, ""), 10);
    const normalizedCity = normalizeCity(city);

    // Prefer postal code match
    if (!Number.isNaN(zipNumber)) {
      const match = rows.find((r) => r.postnummer === zipNumber);
      if (match?.taxepunktspostnummer) return match.taxepunktspostnummer.toString();
    }

    // Fallback to city match
    const cityMatch = rows.find(
      (r) => r.postort?.toUpperCase() === normalizedCity,
    );
    return cityMatch?.taxepunktspostnummer?.toString() ?? "";
  });
}

export async function GET(req: NextRequest) {

  const { error: userError } = await requireUser();
  if (userError) return userError;

  try {
    const { searchParams } = new URL(req.url);

    const useEntireName = parseBooleanParam(searchParams.get("useEntireName"));

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

    const [destinationTaxPoint, resolvedSenderTaxPoint] = await resolveTaxPoints(
      supabase,
      [
        {
          postalCode: consignment.destinationPostalCode || "",
          city: consignment.destinationCity || "",
        },
        {
          postalCode: consignment.pickupPostalCode || "",
          city: consignment.pickupLocationCity || "",
        },
      ],
    );

    const isValidDest = Boolean(destinationTaxPoint);

    let finalTaxPointRelation = consignment.taxPointRelation || "";
    let senderTaxPoint: string | null = null;
    let receiverTaxPoint: string | null = null;

    if (finalTaxPointRelation) {
      const splitResult = splitTaxPointRelation(finalTaxPointRelation);
      senderTaxPoint = splitResult.senderTaxPoint;
      receiverTaxPoint = splitResult.receiverTaxPoint;
    }

    if (!senderTaxPoint) senderTaxPoint = resolvedSenderTaxPoint || null;
    if (!receiverTaxPoint) receiverTaxPoint = destinationTaxPoint || null;

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


    const input: ProfitabilityInput = {
      kundnamn: enrichedConsignment.customerName,
      taxPointRelation: finalTaxPointRelation,
      chargeable_weight: enrichedConsignment.weight ?? 0,
      useEntireName,

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