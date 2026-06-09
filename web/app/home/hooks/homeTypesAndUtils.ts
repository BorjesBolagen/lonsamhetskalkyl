import {
  getIlogConsignments,
  ProfitabilityValue,
} from "../../../lib/api";
import type { ConsignmentListItem, LineItem } from "../../../lib/ilogTypes";
import { normalizeText } from "../../../lib/areaLineConfig";

export const DEFAULT_PROFITABILITY_REFERENCE_VALUE = 15000;
export const HOME_CACHE_KEY = "home-lines-cache-v9";

export type ProfitabilityStatus = "idle" | "loading" | "done" | "error";

export type ConsignmentWithProfitability = ConsignmentListItem & {
  profitabilityValue?: ProfitabilityValue | null;
};

export type EquipageWithConsignments = {
  id: number;
  name: string;
  lineId: number;
  lineName: string;
  consignments: ConsignmentWithProfitability[];
  totalWeightKg: number;
  totalFlm: number;
  totalProfitabilityPrice: number;
  profitabilityBarPercent: number;
  profitabilityStatus: ProfitabilityStatus;
};

export type LineWithEquipages = LineItem & {
  cluster: string;
  equipages: EquipageWithConsignments[];
};

export type HomeCachePayload = {
  selectedDate: string;
  lineCards: LineWithEquipages[];
  candidateEquipageCount: number;
  visibleEquipageCount: number;
  appliedClusterLabels: string[];
};

/**
 * Returns tomorrow in the YYYY-MM-DD format used by the native date input.
 */
export function getDefaultHomeDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const day = String(tomorrow.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Reads the profitability reference value from user filters and falls back to a safe default.
 */
export function parseProfitabilityReferenceValue(filters: unknown): number {
  if (
    typeof filters === "object" &&
    filters !== null &&
    !Array.isArray(filters) &&
    typeof (filters as Record<string, unknown>).profitabilityReferenceValue ===
      "number"
  ) {
    const candidate = (filters as Record<string, unknown>)
      .profitabilityReferenceValue as number;

    if (Number.isFinite(candidate) && candidate > 0) {
      return candidate;
    }
  }

  return DEFAULT_PROFITABILITY_REFERENCE_VALUE;
}

/**
 * Recalculates totals directly from consignments, because cached totals may be missing or stale.
 */
export function ensureEquipageTotals(
  equipage: EquipageWithConsignments,
): EquipageWithConsignments {
  const totalWeightKg = equipage.consignments.reduce(
    (sum, consignment) => sum + (consignment.weight ?? 0),
    0,
  );

  const totalFlm =
    equipage.totalFlm ??
    equipage.consignments.reduce(
      (sum, consignment) => sum + getConsignmentFlm(consignment),
      0,
    );

  const totalProfitabilityPrice =
    equipage.totalProfitabilityPrice ??
    equipage.consignments.reduce(
      (sum, consignment) =>
        sum + (consignment.profitabilityValue?.estimated_revenue ?? 0),
      0,
    );

  return {
    ...equipage,
    totalWeightKg,
    totalFlm,
    totalProfitabilityPrice,
    profitabilityBarPercent: equipage.profitabilityBarPercent ?? 0,
    profitabilityStatus: equipage.profitabilityStatus ?? "idle",
  };
}

/**
 * Normalizes cached line cards so totals are always rebuilt from the consignments.
 */
export function normalizeLineCards(
  lineCards: LineWithEquipages[],
): LineWithEquipages[] {
  return lineCards.map((line) => ({
    ...line,
    equipages: line.equipages.map((equipage) => ensureEquipageTotals(equipage)),
  }));
}

/**
 * Converts the native YYYY-MM-DD date value into the yyyyMMdd format used by iLog.
 */
export function toIlogDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  return value.replace(/-/g, "");
}

/**
 * Splits a line name into its directional parts while removing AVD suffixes.
 */
function splitLineParts(lineName: string): string[] {
  return lineName
    .replace(/\(avd:[^)]+\)/gi, "")
    .split(/\s*-\s*/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Flips the displayed line direction when the selected cluster matches the destination side.
 */
export function orientLineNameForSelectedAreas(
  lineName: string,
  selectedAreaLabels: string[],
): string {
  const parts = splitLineParts(lineName);
  if (parts.length < 2) {
    return lineName;
  }

  const from = parts[0];
  const to = parts.slice(1).join(" - ");

  const selectedAreas = new Set(
    selectedAreaLabels.map((label) => normalizeText(label)),
  );
  const fromIsSelected = selectedAreas.has(normalizeText(from));
  const toIsSelected = selectedAreas.has(normalizeText(to));

  if (!fromIsSelected && toIsSelected) {
    return `${to} - ${from}`;
  }

  return `${from} - ${to}`;
}

/**
 * Finds the most common zoneName among consignments and uses that as the display line hint.
 */
export function getDominantConsignmentLineName(
  consignments: ConsignmentListItem[],
): string | null {
  const counts = new Map<string, number>();

  for (const consignment of consignments) {
    const candidate = consignment.zoneName.trim();
    if (!candidate) {
      continue;
    }

    counts.set(candidate, (counts.get(candidate) ?? 0) + 1);
  }

  let bestName: string | null = null;
  let bestCount = -1;

  for (const [name, count] of counts.entries()) {
    if (count > bestCount) {
      bestName = name;
      bestCount = count;
    }
  }

  return bestName;
}

/**
 * Splits a list into fixed-size batches so consignment requests can run in smaller groups.
 */
export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

/**
 * Fetches consignments for one equipage and retries once on transient failures.
 */
export async function getIlogConsignmentsWithRetry(
  ilogDate: string,
  equipageId: number,
): Promise<ConsignmentListItem[]> {
  // A single retry handles common transient 5xx/network issues from upstream iLog.
  try {
    const response = await getIlogConsignments(ilogDate, equipageId);
    return response.data ?? [];
  } catch {
    const retryResponse = await getIlogConsignments(ilogDate, equipageId);
    return retryResponse.data ?? [];
  }
}

/**
 * Returns the last non-empty name fragment after splitting on asterisks.
 */
function pickTrailingNamePart(rawValue: string): string | null {
  const value = rawValue
    .trim()
    .split("*")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .at(-1);

  return value && value.length > 0 ? value : null;
}

export function toBarPercent(totalPrice: number, threshold: number): number {
  if (!Number.isFinite(threshold) || threshold <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, (totalPrice / threshold) * 100));
}

/** Returns the FLM value from a consignment, defaulting to 0 when missing. */
export function getConsignmentFlm(consignment: ConsignmentListItem): number {
  const rawFlm = (consignment as Record<string, unknown>).flm;
  return typeof rawFlm === "number" ? rawFlm : 0;
}

/**
 * Calls profitability API for one consignment and returns null when input or response is invalid.
 */
export async function calculateConsignmentProfitabilityPrice(
  consignment: ConsignmentListItem,
): Promise<ProfitabilityValue | null> {
  try {
    const res = await fetch("/api/profitability", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      // Vi skickar med HELA bokningen till din nya backend-route
      body: JSON.stringify({ consignment }), 
    });

    // Kontrollera om svaret faktiskt är OK innan vi kör .json()
    if (!res.ok) {
       console.error("API-fel:", res.status, res.statusText);
       return null;
    }

    const data = await res.json();

    if (!data.success) {
      console.error("Fel i kalkyl:", data.error);
      return null;
    }

    return data.value;
  } catch (error) {
    console.error("Fel vid anrop till profitability_simulation", error);
    return null;
  }
}

/**
 * Returns a readable customer name, falling back to pickupLocationName when needed.
 */
export function getDisplayCustomerName(consignment: ConsignmentListItem): string {
  const normalizedCustomerName = pickTrailingNamePart(consignment.customerName);
  if (normalizedCustomerName) {
    return normalizedCustomerName;
  }

  const pickupLocationName = consignment.pickupLocationName.trim();
  if (pickupLocationName.length === 0) {
    return "-";
  }

  return pickTrailingNamePart(pickupLocationName) ?? pickupLocationName;
}
