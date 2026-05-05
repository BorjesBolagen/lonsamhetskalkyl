"use client";

import {
  calculateProfitability,
  getCurrentlySignedInUser,
  getIlogEquipages,
  getIlogLines,
} from "../api";
import type { ProfitabilityValue } from "../api";
import type { ConsignmentListItem, EquipageItem, LineItem } from "../ilogTypes";
import {
  AREA_OPTIONS,
  AreaKey,
  AreaState,
  DEFAULT_AREAS,
  getLineCluster,
  normalizeLineName,
  normalizeText,
  parseAreaState,
} from "../areaLineConfig";
import {
  DEFAULT_MILE_COST,
  DEFAULT_PROFITABILITY_REFERENCE_VALUE,
} from "./constants";

export type LineWithCluster = LineItem & {
  cluster: string;
};

export type FilteredLinesAndEquipages = {
  approvedLines: LineWithCluster[];
  filteredEquipages: EquipageItem[];
};

export type ParsedTaxPointRelation = {
  sender: string;
  receiver: string;
};

export type EquipageLinePlacement = {
  displayLine: LineWithCluster;
  directedLineName: string;
};

export type ConsignmentTotals = {
  totalWeightKg: number;
  totalFlm: number;
};

export type TransportPlanningUserSettings = {
  selectedAreas: AreaState;
  profitabilityReferenceValue: number;
  mileCostReferenceValue: number;
};

export type RouteDistanceResult = {
  distanceKm: number;
  missingDistanceRelation: string | null;
};

export type BestConsecutiveInsertionResult = {
  originalDistanceKm: number;
  optimizedDistanceKm: number | null;
  extraDistanceKm: number | null;
  optimizedStops: string[];
  pickupIndex: number | null;
  deliveryIndex: number | null;
  missingDistanceRelation: string | null;
};

/**
 * Läser användarens sparade referensvärde för prisbar.
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
 * Läser användarens sparade milkostnad för simulatorn.
 */
export function parseMileCostReferenceValue(filters: unknown): number {
  if (
    typeof filters === "object" &&
    filters !== null &&
    !Array.isArray(filters)
  ) {
    const candidate = (filters as Record<string, unknown>)
      .mileCostReferenceValue;

    if (
      typeof candidate === "number" &&
      Number.isFinite(candidate) &&
      candidate > 0
    ) {
      return candidate;
    }
  }

  return DEFAULT_MILE_COST;
}

/**
 * Hämtar användarens transportplaneringsinställningar.
 */
export async function getCurrentTransportPlanningUserSettings() {
  try {
    const response = await getCurrentlySignedInUser();
    const user = response.data;

    if (!user) {
      return {
        selectedAreas: DEFAULT_AREAS,
        profitabilityReferenceValue: DEFAULT_PROFITABILITY_REFERENCE_VALUE,
        mileCostReferenceValue: DEFAULT_MILE_COST,
      };
    }

    return {
      selectedAreas: parseAreaState(user.filters),
      profitabilityReferenceValue: parseProfitabilityReferenceValue(
        user.filters,
      ),
      mileCostReferenceValue: parseMileCostReferenceValue(user.filters),
    };
  } catch {
    return {
      selectedAreas: DEFAULT_AREAS,
      profitabilityReferenceValue: DEFAULT_PROFITABILITY_REFERENCE_VALUE,
      mileCostReferenceValue: DEFAULT_MILE_COST,
    };
  }
}

/**
 * Hämtar valda områdesetiketter från AreaState.
 */
export function getSelectedAreaLabels(selectedAreas: AreaState): string[] {
  return Object.entries(selectedAreas)
    .filter(([, isActive]) => isActive)
    .map(([areaKey]) => AREA_OPTIONS[areaKey as AreaKey]);
}

/**
 * Konverterar datum från YYYY-MM-DD till yyyyMMdd för iLog.
 */
export function toIlogDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  return value.replace(/-/g, "");
}

/**
 * Returnerar morgondagens datum i formatet YYYY-MM-DD.
 */
export function getDefaultNextDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const day = String(tomorrow.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Läser JSON från sessionStorage utan att kasta fel.
 */
export function safeGetSessionStorageJson<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/**
 * Skriver JSON till sessionStorage utan att kasta fel.
 */
export function safeSetSessionStorageJson<T>(key: string, value: T): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
}

/**
 * Begränsar ett procentvärde till intervallet 0–100.
 */
export function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/**
 * Räknar om ett totalvärde till procent mot valt tröskelvärde.
 */
export function toBarPercent(totalValue: number, threshold: number): number {
  if (!Number.isFinite(threshold) || threshold <= 0) {
    return 0;
  }

  return clampPercent((totalValue / threshold) * 100);
}

/**
 * Returnerar sista namndelen efter stjärnseparatorer.
 */
export function pickTrailingNamePart(rawValue?: string | null): string | null {
  if (!rawValue) {
    return null;
  }

  const value = rawValue
    .trim()
    .split("*")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .at(-1);

  return value && value.length > 0 ? value : null;
}

/**
 * Returnerar kundnamn i läsbart format.
 */
export function getDisplayCustomerName(
  consignment: ConsignmentListItem,
): string {
  const normalizedCustomerName = pickTrailingNamePart(consignment.customerName);
  if (normalizedCustomerName) {
    return normalizedCustomerName;
  }

  const pickupLocationName = consignment.pickupLocationName?.trim() ?? "";
  if (pickupLocationName.length === 0) {
    return "-";
  }

  return pickTrailingNamePart(pickupLocationName) ?? pickupLocationName;
}

/**
 * Räknar summerade värden för consignments.
 */
export function calculateConsignmentTotals(
  consignments: ConsignmentListItem[],
): ConsignmentTotals {
  return {
    totalWeightKg: consignments.reduce(
      (sum, consignment) => sum + (consignment.weight ?? 0),
      0,
    ),
    totalFlm: consignments.reduce(
      (sum, consignment) => sum + (consignment.flm ?? 0),
      0,
    ),
  };
}

/**
 * Räknar prognos för en bokning via profitability-motorn.
 * Används av Home.
 */
export async function calculateConsignmentProfitabilityPrice(
  consignment: ConsignmentListItem,
): Promise<ProfitabilityValue | null> {
  const kundnamn = consignment.customerName?.trim();
  const taxPointRelation = consignment.taxPointRelation?.trim();
  const weight = Number(consignment.weight);

  if (!kundnamn || !taxPointRelation || !Number.isFinite(weight)) {
    return null;
  }

  const response = await calculateProfitability(
    kundnamn,
    taxPointRelation,
    weight,
  );

  if (!response.success || !response.value) {
    return null;
  }

  return response.value as ProfitabilityValue;
}

/**
 * Delar upp en taxPointRelation av formatet sender-receiver.
 */
export function parseTaxPointRelation(
  taxPointRelation?: string | null,
): ParsedTaxPointRelation | null {
  if (!taxPointRelation) {
    return null;
  }

  const parts = taxPointRelation
    .split("-")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length !== 2) {
    return null;
  }

  return {
    sender: parts[0],
    receiver: parts[1],
  };
}

/**
 * Räknar körkostnad från km och milpris.
 */
export function calculateExtraDrivingCost(
  distanceKm: number,
  milkostnadPerMil: number,
): number {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    return 0;
  }

  if (!Number.isFinite(milkostnadPerMil) || milkostnadPerMil < 0) {
    return 0;
  }

  return (distanceKm / 10) * milkostnadPerMil;
}

/**
 * Matchar ett klusternamn mot valda områden.
 */
export function lineMatchesSelectedAreas(
  clusterName: string,
  selectedAreaLabels: string[],
): boolean {
  const normalizedSelectedClusters = new Set(
    selectedAreaLabels.map((label) => normalizeText(label)),
  );

  if (normalizedSelectedClusters.size === 0) {
    return false;
  }

  return normalizedSelectedClusters.has(normalizeText(clusterName));
}

/**
 * Filtrerar linjer och ekipage på valda områden.
 */
export function filterLinesAndEquipagesBySelectedAreas(
  lines: LineItem[],
  equipages: EquipageItem[],
  selectedAreaLabels: string[],
): FilteredLinesAndEquipages {
  const rawApprovedLines = lines
    .map((line) => {
      const cluster = getLineCluster(line.name);
      if (!cluster) {
        return null;
      }

      return { ...line, cluster };
    })
    .filter((line): line is LineWithCluster => line !== null)
    .filter((line) =>
      lineMatchesSelectedAreas(line.cluster, selectedAreaLabels),
    );

  const approvedLineMap = new Map<string, LineWithCluster>();

  for (const line of rawApprovedLines) {
    const key = normalizeLineName(line.name);

    if (!approvedLineMap.has(key)) {
      approvedLineMap.set(key, line);
    }
  }

  const approvedLines = Array.from(approvedLineMap.values());

  const filteredLineIds = new Set(approvedLines.map((line) => line.id));
  const filteredLineNames = new Set(
    approvedLines.map((line) => normalizeLineName(line.name)),
  );

  const filteredEquipageMap = new Map<number, EquipageItem>();

  for (const equipage of equipages) {
    const belongsToApprovedLine =
      equipage.linkedLineIds.some((lineId) => filteredLineIds.has(lineId)) ||
      equipage.linkedLineNames.some((lineName) =>
        filteredLineNames.has(normalizeLineName(lineName)),
      );

    if (belongsToApprovedLine && !filteredEquipageMap.has(equipage.id)) {
      filteredEquipageMap.set(equipage.id, equipage);
    }
  }

  return {
    approvedLines,
    filteredEquipages: Array.from(filteredEquipageMap.values()),
  };
}

/**
 * Hämtar och filtrerar linjer/ekipage för valda områden.
 */
export async function loadFilteredLinesAndEquipagesForSelectedAreas(
  selectedAreaLabels: string[],
): Promise<FilteredLinesAndEquipages> {
  const [linesResponse, equipagesResponse] = await Promise.all([
    getIlogLines(),
    getIlogEquipages(),
  ]);

  return filterLinesAndEquipagesBySelectedAreas(
    (linesResponse.data ?? []) as LineItem[],
    (equipagesResponse.data ?? []) as EquipageItem[],
    selectedAreaLabels,
  );
}

/**
 * Alias för simulatorn. Behålls för att undvika namnmissmatch.
 */
export const getFilteredLinesAndEquipagesForAreas =
  loadFilteredLinesAndEquipagesForSelectedAreas;

/**
 * Delar upp en lista i batchar.
 */
export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

/**
 * Delar upp linjenamn i riktningar.
 */
export function splitLineParts(lineName: string): string[] {
  return lineName
    .replace(/\(avd:[^)]+\)/gi, "")
    .split(/\s*-\s*/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Vänder linjenamnet om valt område ligger på destinationssidan.
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
 * Hittar vanligaste zoneName bland ett ekipages bokningar.
 */
export function getDominantConsignmentLineName(
  consignments: ConsignmentListItem[],
): string | null {
  const counts = new Map<string, number>();

  for (const consignment of consignments) {
    const candidate = consignment.zoneName?.trim();
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
 * Avgör vilken linje ett ekipage ska visas under.
 */
export function getEquipageLinePlacement(
  equipage: EquipageItem,
  consignments: ConsignmentListItem[],
  approvedLines: LineWithCluster[],
  selectedAreaLabels: string[],
): EquipageLinePlacement | null {
  if (approvedLines.length === 0 || consignments.length === 0) {
    return null;
  }

  const matchingLines = approvedLines.filter(
    (line) =>
      equipage.linkedLineIds.includes(line.id) ||
      equipage.linkedLineNames.some(
        (lineName) =>
          normalizeLineName(lineName) === normalizeLineName(line.name),
      ),
  );

  const baseLine = matchingLines[0] ?? approvedLines[0];
  if (!baseLine) {
    return null;
  }

  const dominantLineName =
    getDominantConsignmentLineName(consignments) ?? baseLine.name;

  const dominantLine = approvedLines.find(
    (line) =>
      normalizeLineName(line.name) === normalizeLineName(dominantLineName),
  );

  const displayLine = dominantLine ?? baseLine;

  return {
    displayLine,
    directedLineName: orientLineNameForSelectedAreas(
      displayLine.name,
      selectedAreaLabels,
    ),
  };
}

/**
 * Kontrollerar om ett ekipages Home-placering matchar vald linje.
 */
export function equipagePlacementMatchesLine(
  placement: EquipageLinePlacement,
  selectedLine: LineItem,
): boolean {
  return (
    placement.displayLine.id === selectedLine.id ||
    normalizeLineName(placement.displayLine.name) ===
      normalizeLineName(selectedLine.name)
  );
}

/**
 * Bygger delivery-rutt från valt ekipages befintliga bokningar.
 *
 * iLog-API:t ger consignments per ekipage och datum, men ingen separat
 * start-/slutpunkt för ekipaget. Därför härleds:
 * - start = sender i första taxPointRelation
 * - stop = receiver i sista taxPointRelation
 * - mellanliggande stopp = receiver från befintliga bokningar
 */
export function buildDeliveryRouteWithStartAndStop(
  consignments: ConsignmentListItem[],
): string[] {
  const parsedRelations = consignments
    .map((consignment) => parseTaxPointRelation(consignment.taxPointRelation))
    .filter(
      (relation): relation is ParsedTaxPointRelation => relation !== null,
    );

  if (parsedRelations.length === 0) {
    return [];
  }

  const start = parsedRelations[0].sender;
  const deliveries = parsedRelations.map((relation) => relation.receiver);

  return [start, ...deliveries, start].filter(
    (taxPoint, index, route) => index === 0 || taxPoint !== route[index - 1],
  );
}

/**
 * Äldre namn som kan användas av tidigare simulatorversioner.
 */
export const buildRouteStopsFromConsignments =
  buildDeliveryRouteWithStartAndStop;

/**
 * Räknar total ruttlängd för en lista taxepunkter.
 */
export async function calculateRouteDistanceKm(
  stops: string[],
  getDistanceKm: (sender: string, receiver: string) => Promise<number | null>,
): Promise<RouteDistanceResult> {
  let totalDistanceKm = 0;

  for (let index = 0; index < stops.length - 1; index += 1) {
    const from = stops[index];
    const to = stops[index + 1];

    const distanceKm = await getDistanceKm(from, to);

    if (distanceKm === null) {
      return {
        distanceKm: totalDistanceKm,
        missingDistanceRelation: `${from}-${to}`,
      };
    }

    totalDistanceKm += distanceKm;
  }

  return {
    distanceKm: totalDistanceKm,
    missingDistanceRelation: null,
  };
}

/**
 * Lägger in ny pickup och delivery i befintlig rutt.
 *
 * Detta är den snabbare men mer korrekta simulatorvarianten:
 * - befintlig start och stop behålls
 * - befintliga stopp ordnas inte om
 * - pickup måste alltid ligga före delivery
 * - pickup och delivery behöver inte ligga direkt efter varandra
 */
export async function calculateBestPickupBeforeDeliveryInsertion(
  currentStops: string[],
  currentDistanceKm: number,
  pickupTaxPoint: string,
  deliveryTaxPoint: string,
  getDistanceKm: (sender: string, receiver: string) => Promise<number | null>,
): Promise<BestConsecutiveInsertionResult> {
  if (currentStops.length === 0) {
    const distanceKm = await getDistanceKm(pickupTaxPoint, deliveryTaxPoint);

    if (distanceKm === null) {
      return {
        originalDistanceKm: currentDistanceKm,
        optimizedDistanceKm: null,
        extraDistanceKm: null,
        optimizedStops: [pickupTaxPoint, deliveryTaxPoint],
        pickupIndex: null,
        deliveryIndex: null,
        missingDistanceRelation: `${pickupTaxPoint}-${deliveryTaxPoint}`,
      };
    }

    return {
      originalDistanceKm: currentDistanceKm,
      optimizedDistanceKm: distanceKm,
      extraDistanceKm: Math.max(0, distanceKm - currentDistanceKm),
      optimizedStops: [pickupTaxPoint, deliveryTaxPoint],
      pickupIndex: 0,
      deliveryIndex: 1,
      missingDistanceRelation: null,
    };
  }

  if (currentStops.length === 1) {
    const firstLeg = await getDistanceKm(currentStops[0], pickupTaxPoint);

    if (firstLeg === null) {
      return {
        originalDistanceKm: currentDistanceKm,
        optimizedDistanceKm: null,
        extraDistanceKm: null,
        optimizedStops: [...currentStops],
        pickupIndex: null,
        deliveryIndex: null,
        missingDistanceRelation: `${currentStops[0]}-${pickupTaxPoint}`,
      };
    }

    const secondLeg = await getDistanceKm(pickupTaxPoint, deliveryTaxPoint);

    if (secondLeg === null) {
      return {
        originalDistanceKm: currentDistanceKm,
        optimizedDistanceKm: null,
        extraDistanceKm: null,
        optimizedStops: [...currentStops],
        pickupIndex: null,
        deliveryIndex: null,
        missingDistanceRelation: `${pickupTaxPoint}-${deliveryTaxPoint}`,
      };
    }

    const newDistanceKm = firstLeg + secondLeg;

    return {
      originalDistanceKm: currentDistanceKm,
      optimizedDistanceKm: newDistanceKm,
      extraDistanceKm: Math.max(0, newDistanceKm - currentDistanceKm),
      optimizedStops: [currentStops[0], pickupTaxPoint, deliveryTaxPoint],
      pickupIndex: 1,
      deliveryIndex: 2,
      missingDistanceRelation: null,
    };
  }

  let bestDistanceKm = Infinity;
  let bestStops = [...currentStops];
  let bestPickupIndex: number | null = null;
  let bestDeliveryIndex: number | null = null;
  let firstMissingDistanceRelation: string | null = null;

  // Start och stop behålls som första/sista stopp.
  // Därför får nya stopp bara läggas in mellan dem.
  for (
    let pickupIndex = 1;
    pickupIndex < currentStops.length;
    pickupIndex += 1
  ) {
    for (
      let deliveryIndex = pickupIndex + 1;
      deliveryIndex <= currentStops.length;
      deliveryIndex += 1
    ) {
      const candidateStops = [...currentStops];
      candidateStops.splice(pickupIndex, 0, pickupTaxPoint);
      candidateStops.splice(deliveryIndex, 0, deliveryTaxPoint);

      const candidateDistanceResult = await calculateRouteDistanceKm(
        candidateStops,
        getDistanceKm,
      );

      if (candidateDistanceResult.missingDistanceRelation) {
        firstMissingDistanceRelation ??=
          candidateDistanceResult.missingDistanceRelation;
        continue;
      }

      if (candidateDistanceResult.distanceKm < bestDistanceKm) {
        bestDistanceKm = candidateDistanceResult.distanceKm;
        bestStops = candidateStops;
        bestPickupIndex = pickupIndex;
        bestDeliveryIndex = deliveryIndex;
      }
    }
  }

  if (!Number.isFinite(bestDistanceKm)) {
    return {
      originalDistanceKm: currentDistanceKm,
      optimizedDistanceKm: null,
      extraDistanceKm: null,
      optimizedStops: [...currentStops],
      pickupIndex: null,
      deliveryIndex: null,
      missingDistanceRelation: firstMissingDistanceRelation,
    };
  }

  return {
    originalDistanceKm: currentDistanceKm,
    optimizedDistanceKm: bestDistanceKm,
    extraDistanceKm: Math.max(0, bestDistanceKm - currentDistanceKm),
    optimizedStops: bestStops,
    pickupIndex: bestPickupIndex,
    deliveryIndex: bestDeliveryIndex,
    missingDistanceRelation: null,
  };
}

/**
 * Bakåtkompatibelt namn. Använder nu pickup-före-delivery, inte konsekutivt tvång.
 */
export const calculateBestConsecutivePickupDeliveryInsertion =
  calculateBestPickupBeforeDeliveryInsertion;

/**
 * Bakåtkompatibel helper om bara extra km behövs.
 */
export async function calculateBestExtraDistanceKm(
  baseStops: string[],
  pickupTaxPoint: string,
  deliveryTaxPoint: string,
  getDistanceKm: (sender: string, receiver: string) => Promise<number | null>,
): Promise<number | null> {
  const currentDistanceResult = await calculateRouteDistanceKm(
    baseStops,
    getDistanceKm,
  );

  const result = await calculateBestPickupBeforeDeliveryInsertion(
    baseStops,
    currentDistanceResult.distanceKm,
    pickupTaxPoint,
    deliveryTaxPoint,
    getDistanceKm,
  );

  return result.extraDistanceKm;
}

/**
 * Bakåtkompatibelt namn. Kör den snabba konsekutiva insättningen.
 */
export async function calculateBestRouteInsertion(
  baseStops: string[],
  pickupTaxPoint: string,
  deliveryTaxPoint: string,
  getDistanceKm: (sender: string, receiver: string) => Promise<number | null>,
): Promise<BestConsecutiveInsertionResult> {
  const currentDistanceResult = await calculateRouteDistanceKm(
    baseStops,
    getDistanceKm,
  );

  return calculateBestPickupBeforeDeliveryInsertion(
    baseStops,
    currentDistanceResult.distanceKm,
    pickupTaxPoint,
    deliveryTaxPoint,
    getDistanceKm,
  );
}
