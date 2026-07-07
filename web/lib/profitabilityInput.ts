import "server-only";

/**
 * profitabilityInput — bygger indata till lönsamhetsberäkningen från en bokning.
 *
 * Logiken låg tidigare direkt i /api/profitability/route.ts men delas nu av
 * två anropare:
 *   1. API-routen (interaktiv beräkning från Hem-vyn)
 *   2. Det nattliga prognosjobbet (lib/forecastEngine.ts)
 * så att båda garanterat räknar på samma sätt.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabaseServerSchema";
import type { ConsignmentListItem } from "@/lib/ilogTypes";
import type { ProfitabilityInput } from "@/profitability/types";

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

export type PreparedProfitabilityRequest = {
  enrichedConsignment: ConsignmentListItem & { _isDbValidDestination: boolean };
  input: ProfitabilityInput;
};

/**
 * Berikar en bokning med taxepunktsrelation och bygger ProfitabilityInput,
 * exakt som /api/profitability gör inför routeConsignment.
 */
export async function prepareProfitabilityRequest(
  supabase: SupabaseClient<Database>,
  consignment: ConsignmentListItem,
): Promise<PreparedProfitabilityRequest> {
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

  const enrichedConsignment = {
    ...consignment,
    taxPointRelation: finalTaxPointRelation,
    _isDbValidDestination: isValidDest,
  };

  const input: ProfitabilityInput = {
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

  return { enrichedConsignment, input };
}
