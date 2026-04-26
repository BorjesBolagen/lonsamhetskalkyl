"use client";

import { getIlogConsignments, ProfitabilityValue } from "../../lib/api";
import type { ConsignmentListItem, LineItem } from "../../lib/ilogTypes";
import {
  AreaState,
  DEFAULT_AREAS,
  normalizeLineName,
} from "../../lib/areaLineConfig";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  calculateConsignmentProfitabilityPrice,
  calculateConsignmentTotals,
  chunkArray,
  DEFAULT_PROFITABILITY_REFERENCE_VALUE,
  getCurrentTransportPlanningUserSettings,
  getDefaultNextDate,
  getDisplayCustomerName,
  getEquipageLinePlacement,
  getSelectedAreaLabels,
  loadFilteredLinesAndEquipagesForSelectedAreas,
  safeGetSessionStorageJson,
  safeSetSessionStorageJson,
  toBarPercent,
  toIlogDate,
} from "../../lib/backend/transportPlanningUtils";

const HOME_CACHE_KEY = "home-lines-cache-v9";

type ProfitabilityStatus = "idle" | "loading" | "done" | "error";

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
 * Räknar om totalsummor från consignments.
 */
function ensureEquipageTotals(
  equipage: EquipageWithConsignments,
): EquipageWithConsignments {
  const totals = calculateConsignmentTotals(equipage.consignments);
  const totalWeightKg = totals.totalWeightKg;
  const totalFlm = equipage.totalFlm ?? totals.totalFlm;

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
 * Normaliserar cacherade line cards.
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
 * Hämtar consignments för ett ekipage med ett extra försök.
 */
async function getIlogConsignmentsWithRetry(
  ilogDate: string,
  equipageId: number,
): Promise<ConsignmentListItem[]> {
  try {
    const response = await getIlogConsignments(ilogDate, equipageId);
    return response.data ?? [];
  } catch {
    const retryResponse = await getIlogConsignments(ilogDate, equipageId);
    return retryResponse.data ?? [];
  }
}

export { getDisplayCustomerName };

/**
 * Hook för Home-sidans linjer, ekipage och profitability.
 */
export function useHomeLines() {
  const [selectedAreas, setSelectedAreas] = useState<AreaState>(DEFAULT_AREAS);
  const [areasLoaded, setAreasLoaded] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getDefaultNextDate);
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
    () => getSelectedAreaLabels(selectedAreas),
    [selectedAreas],
  );

  /**
   * Tömmer synlig Home-data.
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
    async function loadCurrentUserSettings() {
      const settings = await getCurrentTransportPlanningUserSettings();
      setSelectedAreas(settings.selectedAreas);
      setProfitabilityReferenceValue(settings.profitabilityReferenceValue);
      setAreasLoaded(true);
    }

    loadCurrentUserSettings();
  }, []);

  useEffect(() => {
    if (!areasLoaded) {
      return;
    }

    const cached = safeGetSessionStorageJson<HomeCachePayload>(HOME_CACHE_KEY);
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

    setSelectedDate(cached.selectedDate || getDefaultNextDate());
    setLineCards(normalizedLineCards);
    setHasLoadedLines(true);
    setCandidateEquipageCount(cached.candidateEquipageCount ?? 0);
    setVisibleEquipageCount(cached.visibleEquipageCount ?? 0);
    setAppliedClusterLabels(cached.appliedClusterLabels ?? []);
    setLoadingProfitabilityCount(remainingProfitabilityCount);
  }, [areasLoaded]);

  /**
   * Sparar Home-state i sessionStorage.
   */
  function persistHomeCache(payload: HomeCachePayload): void {
    safeSetSessionStorageJson(HOME_CACHE_KEY, payload);
  }

  /**
   * Sparar aktuell Home-vy efter deluppdateringar.
   */
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

  /**
   * Tar bort Home-cache.
   */
  function clearHomeCache(): void {
    try {
      sessionStorage.removeItem(HOME_CACHE_KEY);
    } catch {
      // ignore storage errors
    }
  }

  /**
   * Uppdaterar ett ekipage i state.
   */
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

  /**
   * Lägger till batch med linjer stegvis i state.
   */
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

  /**
   * Laddar profitability i bakgrunden för ekipage som redan visas.
   */
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
              setLoadingProfitabilityCount((current) =>
                Math.max(0, current - 1),
              );
            }
          }
        }),
      );
    }
  }

  /**
   * Laddar linjer och ekipage för Home.
   */
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

      const { approvedLines, filteredEquipages } =
        await loadFilteredLinesAndEquipagesForSelectedAreas(
          requestedClusterLabels,
        );

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

      setCandidateEquipageCount(filteredEquipages.length);

      const baseEquipages: EquipageWithConsignments[] = [];
      let accumulatedVisibleCount = 0;

      setAppliedClusterLabels(requestedClusterLabels);

      for (const equipageBatch of chunkArray(filteredEquipages, 6)) {
        const groupedByDirectedLine = new Map<string, LineWithEquipages>();

        const batchResults = await Promise.allSettled(
          equipageBatch.map(async (equipage) => {
            const consignments = await getIlogConsignmentsWithRetry(
              ilogDate,
              equipage.id,
            );

            if (consignments.length === 0) {
              return null;
            }

            const placement = getEquipageLinePlacement(
              equipage,
              consignments,
              approvedLines,
              requestedClusterLabels,
            );

            if (!placement) {
              return null;
            }

            const totals = calculateConsignmentTotals(consignments);

            const equipageRow: EquipageWithConsignments = {
              id: equipage.id,
              name: equipage.name,
              lineId: placement.displayLine.id,
              lineName: placement.directedLineName,
              consignments,
              totalWeightKg: totals.totalWeightKg,
              totalFlm: totals.totalFlm,
              totalProfitabilityPrice: 0,
              profitabilityBarPercent: 0,
              profitabilityStatus: "idle",
            };

            return {
              displayLine: placement.displayLine,
              directedLineName: placement.directedLineName,
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

          const directedLineKey = `${displayLine.id}|${normalizeLineName(
            directedLineName,
          )}`;
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

  /**
   * Öppnar popup för ett ekipage.
   */
  const openPopup = (equipage: EquipageWithConsignments) => {
    setSelectedEquipage(ensureEquipageTotals(equipage));
    setIsPopupOpen(true);
  };

  /**
   * Stänger popup.
   */
  const closePopup = () => setIsPopupOpen(false);

  /**
   * Tömmer synlig data och cache.
   */
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
