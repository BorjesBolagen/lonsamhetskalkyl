"use client";

import {
  calculateProfitability,
  getCurrentlySignedInUser,
  getIlogConsignments,
  getIlogEquipages,
  getIlogLines,
  ProfitabilityValue,
} from "../../lib/api";
import type {
  ConsignmentListItem,
  EquipageItem,
  LineItem,
} from "../../lib/ilogTypes";
import {
  AREA_OPTIONS,
  AreaKey,
  AreaState,
  DEFAULT_AREAS,
  getLineCluster,
  normalizeLineName,
  normalizeText,
  parseAreaState,
} from "../../lib/areaLineConfig";
import { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_PROFITABILITY_REFERENCE_VALUE = 15000;
const HOME_CACHE_KEY = "home-lines-cache-v9";

type ProfitabilityStatus = "idle" | "loading" | "done" | "error";

/**
 * Returns tomorrow in the YYYY-MM-DD format used by the native date input.
 */
function getDefaultHomeDate(): string {
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
function parseProfitabilityReferenceValue(filters: unknown): number {
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

type ConsignmentWithProfitability = ConsignmentListItem & {
  profitabilityValue?: ProfitabilityValue | null;
};

type EquipageWithConsignments = {
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

type LineWithEquipages = LineItem & {
  cluster: string;
  equipages: EquipageWithConsignments[];
};

type HomeCachePayload = {
  selectedDate: string;
  lineCards: LineWithEquipages[];
  candidateEquipageCount: number;
  visibleEquipageCount: number;
  appliedClusterLabels: string[];
};

/**
 * Recalculates totals directly from consignments, because cached totals may be missing or stale.
 */
function ensureEquipageTotals(
  equipage: EquipageWithConsignments,
): EquipageWithConsignments {
  const totalWeightKg = equipage.consignments.reduce(
    (sum, consignment) => sum + (consignment.weight ?? 0),
    0,
  );

  const totalFlm =
    equipage.totalFlm ??
    equipage.consignments.reduce(
      (sum, consignment) => sum + ((consignment as any).flm ?? 0),
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
function normalizeLineCards(
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
function toIlogDate(value: string): string | null {
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
function orientLineNameForSelectedAreas(
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
function getDominantConsignmentLineName(
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
function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

/**
 * Fetches consignments for one equipage and retries once on transient failures.
 */
async function getIlogConsignmentsWithRetry(
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

function toBarPercent(totalPrice: number, threshold: number): number {
  if (!Number.isFinite(threshold) || threshold <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, (totalPrice / threshold) * 100));
}

async function calculateConsignmentProfitabilityPrice(
  consignment: ConsignmentListItem,
): Promise<ProfitabilityValue | null> {
  const kundnamn = consignment.customerName?.trim();
  const taxPointRelation = consignment.taxPointRelation?.trim();
  const weight = Number(consignment.weight);

  if (
    !kundnamn ||
    !taxPointRelation ||
    !Number.isFinite(weight) ||
    weight <= 0
  ) {
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

  return response.value;
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

/**
 * Loads the Home view data, applies cluster filters, groups equipages, and manages the cached result.
 */
export function useHomeLines() {
  const [selectedAreas, setSelectedAreas] = useState<AreaState>(DEFAULT_AREAS);
  const [areasLoaded, setAreasLoaded] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getDefaultHomeDate);
  const [profitabilityReferenceValue, setProfitabilityReferenceValue] =
    useState<number>(DEFAULT_PROFITABILITY_REFERENCE_VALUE);

  const [lineCards, setLineCards] = useState<LineWithEquipages[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);
  const [lineError, setLineError] = useState("");
  const [hasLoadedLines, setHasLoadedLines] = useState(false);
  const [candidateEquipageCount, setCandidateEquipageCount] = useState(0);
  const [visibleEquipageCount, setVisibleEquipageCount] = useState(0);
  const [loadingProfitabilityCount, setLoadingProfitabilityCount] = useState(0);

  const [selectedEquipage, setSelectedEquipage] =
    useState<EquipageWithConsignments | null>(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [appliedClusterLabels, setAppliedClusterLabels] = useState<string[]>(
    [],
  );

  const latestLoadIdRef = useRef(0);

  const selectedAreaLabels = useMemo(
    () =>
      Object.entries(selectedAreas)
        .filter(([, isActive]) => isActive)
        .map(([areaKey]) => AREA_OPTIONS[areaKey as AreaKey]),
    [selectedAreas],
  );

 /**
   * Matches a line cluster against the currently selected cluster labels.
   */
  const normalizedSelectedClusters = useMemo(
    () => new Set(selectedAreaLabels.map((label) => normalizeText(label))),
    [selectedAreaLabels],
  );

  /**
   * Returns true when a line belongs to one of the selected clusters.
   */
  function lineMatchesSelectedAreas(clusterName: string): boolean {
    if (normalizedSelectedClusters.size === 0) {
      return false;
    }

    return normalizedSelectedClusters.has(normalizeText(clusterName));
  }

  /**
   * Clears only the visible Home state while keeping user settings intact.
   */
  function resetDisplayedData(): void {
    setLineCards([]);
    setCandidateEquipageCount(0);
    setVisibleEquipageCount(0);
    setLoadingProfitabilityCount(0);
    setSelectedEquipage(null);
    setIsPopupOpen(false);
  }

  useEffect(() => {
    /** Load persisted user cluster preferences once on mount. */
    async function loadCurrentUserSettings() {
      try {
        const response = await getCurrentlySignedInUser();
        const user = response.data;

        if (user) {
          setSelectedAreas(parseAreaState(user.filters));
          setProfitabilityReferenceValue(
            parseProfitabilityReferenceValue(user.filters),
          );
        } else {
          setSelectedAreas(DEFAULT_AREAS);
          setProfitabilityReferenceValue(DEFAULT_PROFITABILITY_REFERENCE_VALUE);
        }
      } catch {
        setSelectedAreas(DEFAULT_AREAS);
        setProfitabilityReferenceValue(DEFAULT_PROFITABILITY_REFERENCE_VALUE);
      } finally {
        setAreasLoaded(true);
      }
    }

    loadCurrentUserSettings();
  }, []);

  useEffect(() => {
    if (!areasLoaded) {
      return;
    }

    try {
      /** Restore the last fetched Home result to avoid a refetch on quick navigation. */
      const raw = sessionStorage.getItem(HOME_CACHE_KEY);
      if (!raw) {
        return;
      }

      const cached = JSON.parse(raw) as HomeCachePayload;
      if (!cached || !Array.isArray(cached.lineCards)) {
        return;
      }

      const normalizedLineCards = normalizeLineCards(cached.lineCards);
      const remainingProfitabilityCount = normalizedLineCards.reduce(
        (sum, line) =>
          sum +
          line.equipages.filter(
            (equipage) => equipage.profitabilityStatus === "loading",
          ).length,
        0,
      );

      setSelectedDate(cached.selectedDate || getDefaultHomeDate());
      setLineCards(normalizedLineCards);
      setHasLoadedLines(true);
      setCandidateEquipageCount(cached.candidateEquipageCount ?? 0);
      setVisibleEquipageCount(cached.visibleEquipageCount ?? 0);
      setAppliedClusterLabels(cached.appliedClusterLabels ?? []);
      setLoadingProfitabilityCount(remainingProfitabilityCount);
    } catch {
      // ignore malformed cache
    }
  }, [areasLoaded]);

  /**
   * Persists the current Home payload in sessionStorage.
   */
  function persistHomeCache(payload: HomeCachePayload): void {
    try {
      sessionStorage.setItem(HOME_CACHE_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage errors
    }
  }

  function persistCurrentHomeCache(nextLineCards: LineWithEquipages[]): void {
    const nextVisibleEquipageCount = nextLineCards.reduce(
      (sum, line) => sum + line.equipages.length,
      0,
    );

    persistHomeCache({
      selectedDate,
      lineCards: nextLineCards,
      candidateEquipageCount,
      visibleEquipageCount: nextVisibleEquipageCount,
      appliedClusterLabels,
    });
  }

  function clearHomeCache(): void {
    try {
      sessionStorage.removeItem(HOME_CACHE_KEY);
    } catch {
      // ignore storage errors
    }
  }

  function updateEquipageInState(
    equipageId: number,
    updater: (equipage: EquipageWithConsignments) => EquipageWithConsignments,
  ): void {
    setLineCards((currentLines) => {
      let changed = false;

      const nextLines = currentLines.map((line) => {
        let lineChanged = false;

        const nextEquipages = line.equipages.map((equipage) => {
          if (equipage.id !== equipageId) {
            return equipage;
          }

          changed = true;
          lineChanged = true;
          return ensureEquipageTotals(updater(equipage));
        });

        return lineChanged ? { ...line, equipages: nextEquipages } : line;
      });

      if (changed) {
        persistCurrentHomeCache(nextLines);
      }

      return changed ? nextLines : currentLines;
    });

    setSelectedEquipage((current) => {
      if (!current || current.id !== equipageId) {
        return current;
      }

      return ensureEquipageTotals(updater(current));
    });
  }

  function mergeLineBatchIntoState(batchLines: LineWithEquipages[]): void {
    setLineCards((currentLines) => {
      const lineMap = new Map<string, LineWithEquipages>();

      for (const line of currentLines) {
        const key = `${line.id}|${normalizeLineName(line.name)}`;
        lineMap.set(key, {
          ...line,
          equipages: [...line.equipages],
        });
      }

      for (const line of batchLines) {
        const key = `${line.id}|${normalizeLineName(line.name)}`;
        const existingLine = lineMap.get(key);

        if (!existingLine) {
          lineMap.set(key, {
            ...line,
            equipages: [...line.equipages].sort((a, b) =>
              a.name.localeCompare(b.name, "sv"),
            ),
          });
          continue;
        }

        const equipageMap = new Map<number, EquipageWithConsignments>();
        for (const equipage of existingLine.equipages) {
          equipageMap.set(equipage.id, equipage);
        }

        for (const equipage of line.equipages) {
          equipageMap.set(equipage.id, equipage);
        }

        existingLine.equipages = Array.from(equipageMap.values()).sort((a, b) =>
          a.name.localeCompare(b.name, "sv"),
        );
      }

      const nextLines = Array.from(lineMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name, "sv"),
      );

      persistCurrentHomeCache(nextLines);
      return nextLines;
    });
  }

  async function hydrateProfitabilityForEquipages(
    loadId: number,
    equipages: EquipageWithConsignments[],
  ): Promise<void> {
    const equipagesToHydrate = equipages.filter(
      (equipage) => equipage.consignments.length > 0,
    );

    setLoadingProfitabilityCount(equipagesToHydrate.length);

    for (const equipageBatch of chunkArray(equipagesToHydrate, 4)) {
      await Promise.allSettled(
        equipageBatch.map(async (equipage) => {
          if (latestLoadIdRef.current !== loadId) {
            return;
          }

          updateEquipageInState(equipage.id, (current) => ({
            ...current,
            profitabilityStatus: "loading",
          }));

          try {
            const enrichedConsignments: ConsignmentWithProfitability[] =
              await Promise.all(
                equipage.consignments.map(async (consignment) => {
                  try {
                    const profitabilityValue =
                      await calculateConsignmentProfitabilityPrice(consignment);

                    return {
                      ...consignment,
                      profitabilityValue,
                    };
                  } catch {
                    return {
                      ...consignment,
                      profitabilityValue: null,
                    };
                  }
                }),
              );

            if (latestLoadIdRef.current !== loadId) {
              return;
            }

            const totalProfitabilityPrice = enrichedConsignments.reduce(
              (sum, consignment) =>
                sum + (consignment.profitabilityValue?.estimated_revenue ?? 0),
              0,
            );

            updateEquipageInState(equipage.id, (current) => ({
              ...current,
              consignments: enrichedConsignments,
              totalProfitabilityPrice,
              profitabilityBarPercent: toBarPercent(
                totalProfitabilityPrice,
                profitabilityReferenceValue,
              ),
              profitabilityStatus: "done",
            }));
          } catch {
            if (latestLoadIdRef.current !== loadId) {
              return;
            }

            updateEquipageInState(equipage.id, (current) => ({
              ...current,
              profitabilityStatus: "error",
            }));
          } finally {
            if (latestLoadIdRef.current === loadId) {
              setLoadingProfitabilityCount((current) => Math.max(0, current - 1));
            }
          }
        }),
      );
    }
  }

  const loadLines = async () => {
    const loadId = Date.now();
    latestLoadIdRef.current = loadId;

    try {
      const requestedClusterLabels = [...selectedAreaLabels];
      setLoadingLines(true);
      setLoadingProfitabilityCount(0);
      setLineError("");
      setHasLoadedLines(true);
      setLineCards([]);
      setVisibleEquipageCount(0);

      const ilogDate = toIlogDate(selectedDate);
      if (!ilogDate) {
        setLineError("Ogiltigt datum. Välj ett datum i formatet YYYY-MM-DD.");
        resetDisplayedData();
        return;
      }

      if (selectedAreaLabels.length === 0) {
        resetDisplayedData();
        setAppliedClusterLabels([]);
        clearHomeCache();
        return;
      }

      const [linesResponse, equipagesResponse] = await Promise.all([
        getIlogLines(),
        getIlogEquipages(),
      ]);

      // Step 1: keep only lines that can be mapped to selected clusters.
      const approvedLines = ((linesResponse.data ?? []) as LineItem[])
        .map((line) => {
          const cluster = getLineCluster(line.name);
          if (!cluster) {
            return null;
          }

          return { ...line, cluster };
        })
        .filter((line): line is LineWithEquipages => line !== null)
        .filter((line) => lineMatchesSelectedAreas(line.cluster));

      if (approvedLines.length === 0) {
        resetDisplayedData();
        persistHomeCache({
          selectedDate,
          lineCards: [],
          candidateEquipageCount: 0,
          visibleEquipageCount: 0,
          appliedClusterLabels: requestedClusterLabels,
        });
        setAppliedClusterLabels(requestedClusterLabels);
        return;
      }

      const filteredLineIds = new Set(approvedLines.map((line) => line.id));
      const filteredLineNames = new Set(
        approvedLines.map((line) => normalizeLineName(line.name)),
      );

      // Step 2: keep equipages linked to approved lines.
      // iLog can return dupes, dedupe by equipage ID during selection.
      const filteredEquipageMap = new Map<number, EquipageItem>();
      for (const equipage of (equipagesResponse.data ?? []) as EquipageItem[]) {
        const belongsToApprovedLine =
          equipage.linkedLineIds.some((lineId) => filteredLineIds.has(lineId)) ||
          equipage.linkedLineNames.some((lineName) =>
            filteredLineNames.has(normalizeLineName(lineName)),
          );

        if (belongsToApprovedLine && !filteredEquipageMap.has(equipage.id)) {
          filteredEquipageMap.set(equipage.id, equipage);
        }
      }

      const filteredEquipages = Array.from(filteredEquipageMap.values());

      setCandidateEquipageCount(filteredEquipages.length);

      const baseEquipages: EquipageWithConsignments[] = [];
      let accumulatedVisibleCount = 0;

      setAppliedClusterLabels(requestedClusterLabels);

      // Step 3: fetch consignments in batches and build display rows.
      for (const equipageBatch of chunkArray(filteredEquipages, 6)) {
        const groupedByDirectedLine = new Map<string, LineWithEquipages>();

        const batchResults = await Promise.allSettled(
          equipageBatch.map(async (equipage) => {
            const consignments = await getIlogConsignmentsWithRetry(
              ilogDate,
              equipage.id,
            );

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

            const visibleConsignments = consignments;

            if (visibleConsignments.length === 0) {
              return null;
            }

            const dominantLineName =
              getDominantConsignmentLineName(visibleConsignments) ?? baseLine.name;
            const dominantLine = approvedLines.find(
              (line) =>
                normalizeLineName(line.name) ===
                normalizeLineName(dominantLineName),
            );
            const displayLine = dominantLine ?? baseLine;
            const directedLineName = orientLineNameForSelectedAreas(
              displayLine.name,
              requestedClusterLabels,
            );

            const equipageRow: EquipageWithConsignments = {
              id: equipage.id,
              name: equipage.name,
              // lineId is used for stable grouping and matching; lineName is what the user sees.
              lineId: displayLine.id,
              lineName: directedLineName,
              consignments: visibleConsignments,
              totalWeightKg: visibleConsignments.reduce(
                (sum, consignment) => sum + (consignment.weight ?? 0),
                0,
              ),
              totalFlm: visibleConsignments.reduce(
                (sum, consignment) => sum + ((consignment as any).flm ?? 0),
                0,
              ),
              totalProfitabilityPrice: 0,
              profitabilityBarPercent: 0,
              profitabilityStatus: "idle",
            };

            return {
              displayLine,
              directedLineName,
              equipageRow,
            };
          }),
        );

        if (latestLoadIdRef.current !== loadId) {
          return;
        }

        for (const result of batchResults) {
          if (result.status !== "fulfilled" || result.value === null) {
            continue;
          }

          const { displayLine, directedLineName, equipageRow } = result.value;
          baseEquipages.push(equipageRow);
          accumulatedVisibleCount += 1;

          const directedLineKey = `${displayLine.id}|${normalizeLineName(directedLineName)}`;
          const lineBucket = groupedByDirectedLine.get(directedLineKey);

          if (lineBucket) {
            lineBucket.equipages.push(equipageRow);
          } else {
            groupedByDirectedLine.set(directedLineKey, {
              ...displayLine,
              name: directedLineName,
              equipages: [equipageRow],
            });
          }
        }

        const batchLines = Array.from(groupedByDirectedLine.values())
          .map((line) => ({
            ...line,
            equipages: line.equipages.sort((a, b) =>
              a.name.localeCompare(b.name, "sv"),
            ),
          }))
          .filter((line) => line.equipages.length > 0)
          .sort((a, b) => a.name.localeCompare(b.name, "sv"));

        mergeLineBatchIntoState(batchLines);
        setVisibleEquipageCount(accumulatedVisibleCount);
      }

      setVisibleEquipageCount(accumulatedVisibleCount);

      void hydrateProfitabilityForEquipages(loadId, baseEquipages);
    } catch {
      setLineError("Kunde inte hämta filtrerade linjer, försök igen.");
      resetDisplayedData();
      setAppliedClusterLabels([]);
    } finally {
      if (latestLoadIdRef.current === loadId) {
        setLoadingLines(false);
      }
    }
  };

  /** Open the popup for one equipage. */
  const openPopup = (equipage: EquipageWithConsignments) => {
    setSelectedEquipage(ensureEquipageTotals(equipage));
    setIsPopupOpen(true);
  };

  /** Close the popup. */
  const closePopup = () => setIsPopupOpen(false);

  /** Clear the visible results and remove the cached Home payload. */
  const clearDisplayedLines = () => {
    latestLoadIdRef.current = Date.now();
    resetDisplayedData();
    setLineError("");
    setHasLoadedLines(false);
    setAppliedClusterLabels([]);
    clearHomeCache();
  };

  return {
    selectedDate,
    setSelectedDate,
    profitabilityReferenceValue,
    lineCards,
    loadingLines,
    loadingProfitabilityCount,
    lineError,
    hasLoadedLines,
    candidateEquipageCount,
    visibleEquipageCount,
    appliedClusterLabels,
    selectedAreaLabels,
    selectedEquipage,
    isPopupOpen,
    areasLoaded,
    loadLines,
    clearDisplayedLines,
    openPopup,
    closePopup,
  };
}