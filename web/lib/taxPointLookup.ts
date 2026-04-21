import "server-only";

import type { ConsignmentListItem } from "@/lib/ilogTypes";
import { getSupabaseAdminClient } from "@/lib/supabaseServer";

type TaxPointRow = {
  postnummer: number | null;
  postort: string | null;
  kontor: string | null;
  kontorsforkortning: string | null;
  taxepunktspostnummer: number | null;
  taxepunkt: string | null;
};

/**
 * Keep only digits so postal code comparisons are format-independent.
 */
const normalizeDigits = (value: string): string => value.replace(/\D/g, "");

/**
 * Normalize place names for stable lookups (trim, uppercase, remove diacritics).
 */
const normalizePlace = (value: string): string =>
  value
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

/**
 * Convert lookup row tax point postal code to a comparable string value.
 */
const asTaxPointPostCodeValue = (row: TaxPointRow): string => {
  if (typeof row.taxepunktspostnummer === "number" && Number.isFinite(row.taxepunktspostnummer)) {
    return String(Math.trunc(row.taxepunktspostnummer));
  }

  return "";
};

/**
 * Split large arrays into smaller chunks to keep DB IN-queries safe.
 */
const chunk = <T>(items: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
};

/**
 * Fetch tax point lookup rows by postal codes and postorts from Supabase.
 */
const fetchTaxPointRows = async (
  postalCodes: string[],
  postorts: string[],
): Promise<TaxPointRow[]> => {
  const supabase = getSupabaseAdminClient();

  const rows: TaxPointRow[] = [];

  for (const postalCodeChunk of chunk(postalCodes, 500)) {
    if (postalCodeChunk.length === 0) {
      continue;
    }

    const response = await supabase
      .from("tax_point_lookup")
      .select("postnummer, postort, kontor, kontorsforkortning, taxepunktspostnummer, taxepunkt")
      .in(
        "postnummer",
        postalCodeChunk.map((value) => Number(value)).filter((value) => Number.isFinite(value)),
      );

    if (response.error) {
      throw new Error(`Kunde inte läsa taxepunkter (postnummer): ${response.error.message}`);
    }

    rows.push(...(response.data ?? []));
  }

  for (const postort of postorts) {
    const response = await supabase
      .from("tax_point_lookup")
      .select("postnummer, postort, kontor, kontorsforkortning, taxepunktspostnummer, taxepunkt")
      .ilike("postort", postort);

    if (response.error) {
      throw new Error(`Kunde inte läsa taxepunkter (postort): ${response.error.message}`);
    }

    rows.push(...(response.data ?? []));
  }

  return rows;
};

/**
 * Enrich consignments with taxPointRelation using postal code first, then place fallback.
 */
export async function enrichTaxPointRelationFromSupabase(
  consignments: ConsignmentListItem[],
): Promise<ConsignmentListItem[]> {
  const postalCodes = Array.from(
    new Set(
      consignments
        .flatMap((item) => [item.pickupPostalCode, item.destinationPostalCode])
        .map((value) => normalizeDigits(value))
        .filter((value) => value.length > 0),
    ),
  );

  const postorts = Array.from(
    new Set(
      consignments
        .flatMap((item) => [item.pickupLocationCity, item.destinationCity])
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );

  if (postalCodes.length === 0 && postorts.length === 0) {
    return consignments;
  }

  let rows: TaxPointRow[] = [];
  try {
    rows = await fetchTaxPointRows(postalCodes, postorts);
  } catch {
    // Fail soft: keep original consignments if lookup is unavailable.
    return consignments;
  }

  const byPostalCode = new Map<string, string>();
  const byPostort = new Map<string, string>();

  for (const row of rows) {
    const taxPoint = asTaxPointPostCodeValue(row);
    if (!taxPoint) {
      continue;
    }

    const postalCode =
      typeof row.postnummer === "number" && Number.isFinite(row.postnummer)
        ? String(Math.trunc(row.postnummer))
        : "";
    if (postalCode.length > 0 && !byPostalCode.has(postalCode)) {
      byPostalCode.set(postalCode, taxPoint);
    }

    const postort = normalizePlace(row.postort ?? "");
    if (postort.length > 0 && !byPostort.has(postort)) {
      byPostort.set(postort, taxPoint);
    }
  }

  return consignments.map((item) => {
    const normalizedPickupPostalCode = normalizeDigits(item.pickupPostalCode);
    const normalizedDestinationPostalCode = normalizeDigits(item.destinationPostalCode);

    const fromTaxPoint =
      normalizedPickupPostalCode.length > 0
        ? byPostalCode.get(normalizedPickupPostalCode)
        : byPostort.get(normalizePlace(item.pickupLocationCity));

    const toTaxPoint =
      normalizedDestinationPostalCode.length > 0
        ? byPostalCode.get(normalizedDestinationPostalCode)
        : byPostort.get(normalizePlace(item.destinationCity));

    if (!fromTaxPoint || !toTaxPoint) {
      return item;
    }

    return {
      ...item,
      taxPointRelation: `${fromTaxPoint}-${toTaxPoint}`,
    };
  });
}
