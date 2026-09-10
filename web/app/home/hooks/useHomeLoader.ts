"use client";

import { useState } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import {
  getIlogEquipages,
  getIlogLineConsignments,
  getIlogLines,
} from "../../../lib/api";
import type {
  ConsignmentListItem,
  EquipageItem,
  LineItem,
} from "../../../lib/ilogTypes";
import {
  getLineCluster,
  normalizeLineName,
  normalizeText,
} from "../../../lib/areaLineConfig";
import { clearHomeCache, persistHomeCache } from "./useHomeCache";
import {
  chunkArray,
  EquipageWithConsignments,
  getConsignmentFlm,
  getDominantConsignmentLineName,
  getIlogConsignmentsWithRetry,
  LineWithEquipages,
  orientLineNameForSelectedAreas,
  toIlogDate,
  VehicleSelectorMode,
} from "./homeTypesAndUtils";

type UseHomeLoaderParams = {
  selectedDate: string;
  vehicleSelectorMode: VehicleSelectorMode;
  selectedEquipageIds: number[];
  selectedLineIds: number[];
  selectedAreaLabels: string[];
  // Temporary flag for the admin-only "Nytt linjeval" path.
  groupByConsignmentLines: boolean;
  lineCards: LineWithEquipages[];
  setLineCards: Dispatch<SetStateAction<LineWithEquipages[]>>;
  setCandidateEquipageCount: Dispatch<SetStateAction<number>>;
  setVisibleEquipageCount: Dispatch<SetStateAction<number>>;
  setLoadingProfitabilityCount: Dispatch<SetStateAction<number>>;
  latestLoadIdRef: MutableRefObject<number>;
  resetDisplayedData: () => void;
  mergeLineBatchIntoState: (batchLines: LineWithEquipages[]) => void;
  updateEquipageInState: (
    equipageId: number,
    updater: (equipage: EquipageWithConsignments) => EquipageWithConsignments,
  ) => void;
  hydrateProfitabilityForEquipages: (
    loadId: number,
    equipages: EquipageWithConsignments[],
  ) => Promise<void>;
  setAppliedFilterLabels: Dispatch<SetStateAction<string[]>>;
};

function buildLineLookup(lines: LineItem[]) {
  const lineById = new Map<number, LineItem>();
  const lineByNormalizedName = new Map<string, LineItem>();

  for (const line of lines) {
    lineById.set(line.id, line);
    lineByNormalizedName.set(normalizeLineName(line.name), line);
  }

  return { lineById, lineByNormalizedName };
}

function findMatchingLineForEquipage(
  equipage: EquipageItem,
  lineById: Map<number, LineItem>,
  lineByNormalizedName: Map<string, LineItem>,
): LineItem | null {
  const lineFromId = equipage.linkedLineIds
    .map((lineId) => lineById.get(lineId))
    .find((line): line is LineItem => Boolean(line));

  if (lineFromId) {
    return lineFromId;
  }

  return (
    equipage.linkedLineNames
      .map((lineName) => lineByNormalizedName.get(normalizeLineName(lineName)))
      .find((line): line is LineItem => Boolean(line)) ?? null
  );
}

function makeEquipageFallbackLine(equipage: EquipageItem): LineItem {
  return {
    id: equipage.id,
    name: equipage.name,
    mine: true,
    type: "EQUIPAGE",
    publicId: equipage.id,
  } as LineItem;
}

const LINE_CONSIGNMENT_TYPES = new Set(["ZONE", "ZONEFILTER", "ZONEGROUP"]);

/** Equipage names come from the same iLog records, so a trimmed casefold is enough. */
function normalizeEquipageName(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Fetches every booking on one line for the date, both assigned and unassigned.
 *
 * Returns an empty list for line types iLog has no consignment endpoint for, so one
 * odd line cannot break the whole load.
 */
async function getConsignmentsForLine(
  ilogDate: string,
  line: LineItem,
): Promise<ConsignmentListItem[]> {
  const lineType = (line.type ?? "").toUpperCase();

  if (!LINE_CONSIGNMENT_TYPES.has(lineType)) {
    return [];
  }

  const response = await getIlogLineConsignments(
    ilogDate,
    line.id,
    lineType as "ZONE" | "ZONEFILTER" | "ZONEGROUP",
  );

  return response.data ?? [];
}

/**
 * Resolves the equipage a booking sits on.
 *
 * iLog does not always send the equipage id, so the name is matched against the
 * equipage list as a fallback. When the id is present but the equipage is outside the
 * user's group, a minimal item is synthesized so the truck can still be shown.
 */
function resolveConsignmentEquipage(
  consignment: ConsignmentListItem,
  equipageById: Map<number, EquipageItem>,
  equipageByName: Map<string, EquipageItem>,
): EquipageItem | null {
  const equipageName = consignment.equipageName.trim();

  if (consignment.equipageId !== null) {
    const known = equipageById.get(consignment.equipageId);
    if (known) {
      return known;
    }

    if (equipageName) {
      return {
        id: consignment.equipageId,
        name: equipageName,
        linkedLineIds: [],
        linkedLineNames: [],
      };
    }
  }

  if (!equipageName) {
    return null;
  }

  return equipageByName.get(normalizeEquipageName(equipageName)) ?? null;
}

function createEquipageRow(
  equipage: EquipageItem,
  displayLineId: number,
  displayLineName: string,
  consignments: Awaited<ReturnType<typeof getIlogConsignmentsWithRetry>>,
): EquipageWithConsignments {
  return {
    id: equipage.id,
    name: equipage.name,
    lineId: displayLineId,
    lineName: displayLineName,
    consignments,
    totalWeightKg: consignments.reduce(
      (sum, consignment) => sum + (consignment.weight ?? 0),
      0,
    ),
    totalFlm: consignments.reduce(
      (sum, consignment) => sum + getConsignmentFlm(consignment),
      0,
    ),
    totalProfitabilityPrice: 0,
    profitabilityBarPercent: 0,
    profitabilityStatus: "idle",
  };
}

/**
 * Handles Home data loading and refresh flows for lines/equipages/consignments.
 */
export function useHomeLoader({
  selectedDate,
  vehicleSelectorMode,
  selectedEquipageIds,
  selectedLineIds,
  selectedAreaLabels,
  groupByConsignmentLines,
  lineCards,
  setCandidateEquipageCount,
  setVisibleEquipageCount,
  setLoadingProfitabilityCount,
  latestLoadIdRef,
  resetDisplayedData,
  mergeLineBatchIntoState,
  updateEquipageInState,
  hydrateProfitabilityForEquipages,
  setAppliedFilterLabels,
}: UseHomeLoaderParams) {
  const [loadingLines, setLoadingLines] = useState(false);
  const [lineError, setLineError] = useState("");
  const [hasLoadedLines, setHasLoadedLines] = useState(false);
  const [refreshingEquipages, setRefreshingEquipages] = useState<Set<number>>(
    () => new Set(),
  );
  const [refreshingLines, setRefreshingLines] = useState<Set<number>>(
    () => new Set(),
  );
  // "Nytt linjeval": trucks found on the selected lines that could not be shown.
  const [unavailableEquipageCount, setUnavailableEquipageCount] = useState(0);
  // "Nytt linjeval": lines whose bookings could not be fetched at all.
  const [failedLineCount, setFailedLineCount] = useState(0);

  const persistEmptyResult = (appliedFilterLabels: string[]) => {
    persistHomeCache({
      selectedDate,
      lineCards: [],
      candidateEquipageCount: 0,
      visibleEquipageCount: 0,
      vehicleSelectorMode,
      selectedEquipageIds,
      selectedLineIds,
      selectedAreaLabels,
      appliedFilterLabels,
      groupByConsignmentLines,
    });
    setAppliedFilterLabels(appliedFilterLabels);
  };

  async function loadEquipageCards(
    ilogDate: string,
    lines: LineItem[],
    equipages: EquipageItem[],
    loadId: number,
  ): Promise<void> {
    if (selectedEquipageIds.length === 0) {
      resetDisplayedData();
      persistEmptyResult([]);
      return;
    }

    const selectedIdSet = new Set(selectedEquipageIds);
    const filteredEquipages = equipages.filter((equipage) =>
      selectedIdSet.has(equipage.id),
    );
    const requestedFilterLabels = filteredEquipages.map((equipage) => equipage.name);

    setCandidateEquipageCount(filteredEquipages.length);
    setAppliedFilterLabels(requestedFilterLabels);

    const { lineById, lineByNormalizedName } = buildLineLookup(lines);
    const baseEquipages: EquipageWithConsignments[] = [];
    let accumulatedVisibleCount = 0;

    for (const equipageBatch of chunkArray(filteredEquipages, 6)) {
      const batchResults = await Promise.allSettled(
        equipageBatch.map(async (equipage) => {
          const consignments = await getIlogConsignmentsWithRetry(
            ilogDate,
            equipage.id,
          );

          if (consignments.length === 0) {
            return null;
          }

          const matchingLine = findMatchingLineForEquipage(
            equipage,
            lineById,
            lineByNormalizedName,
          );
          const displayLine = matchingLine ?? makeEquipageFallbackLine(equipage);
          const displayLineName = matchingLine?.name ?? equipage.linkedLineNames[0] ?? "-";
          const equipageRow = createEquipageRow(
            equipage,
            displayLine.id,
            displayLineName,
            consignments,
          );

          const equipageCardContainer: LineWithEquipages = {
            ...displayLine,
            id: equipage.id,
            name: equipage.name,
            cluster: "Ekipage",
            equipages: [equipageRow],
          };

          return { equipageRow, equipageCardContainer };
        }),
      );

      if (latestLoadIdRef.current !== loadId) {
        return;
      }

      const batchCards: LineWithEquipages[] = [];
      for (const result of batchResults) {
        if (result.status !== "fulfilled" || result.value === null) {
          continue;
        }

        baseEquipages.push(result.value.equipageRow);
        batchCards.push(result.value.equipageCardContainer);
        accumulatedVisibleCount += 1;
      }

      mergeLineBatchIntoState(
        batchCards.sort((a, b) => a.name.localeCompare(b.name, "sv")),
      );
      setVisibleEquipageCount(accumulatedVisibleCount);
    }

    setVisibleEquipageCount(accumulatedVisibleCount);
    void hydrateProfitabilityForEquipages(loadId, baseEquipages);
  }

  async function loadLineCards(
    ilogDate: string,
    lines: LineItem[],
    equipages: EquipageItem[],
    loadId: number,
  ): Promise<void> {
    if (selectedLineIds.length === 0) {
      resetDisplayedData();
      persistEmptyResult([]);
      return;
    }

    const selectedLineIdSet = new Set(selectedLineIds);

    const approvedLines = lines
      .map((line) => ({
        ...line,
        cluster: getLineCluster(line.name) ?? "",
      }))
      .filter((line): line is LineWithEquipages => {
        return selectedLineIdSet.has(line.id);
      });

    const requestedFilterLabels = approvedLines.map((line) => line.name);
    const orientationLabels: string[] = [];

    if (approvedLines.length === 0) {
      resetDisplayedData();
      persistEmptyResult(requestedFilterLabels);
      return;
    }

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

    const filteredEquipages = Array.from(filteredEquipageMap.values());

    setCandidateEquipageCount(filteredEquipages.length);
    setAppliedFilterLabels(requestedFilterLabels);

    const baseEquipages: EquipageWithConsignments[] = [];
    let accumulatedVisibleCount = 0;

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
          if (!baseLine || consignments.length === 0) {
            return null;
          }

          const dominantLineName =
            getDominantConsignmentLineName(consignments) ?? baseLine.name;
          const dominantLine = approvedLines.find(
            (line) =>
              normalizeLineName(line.name) === normalizeLineName(dominantLineName),
          );
          const displayLine = dominantLine ?? baseLine;
          const directedLineName = orientLineNameForSelectedAreas(
            displayLine.name,
            orientationLabels,
          );
          const equipageRow = createEquipageRow(
            equipage,
            displayLine.id,
            directedLineName,
            consignments,
          );

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
  }

  /**
   * "Nytt linjeval" (admin test path): asks each selected line which bookings it has,
   * and lets those bookings point out the trucks.
   *
   * The old path asks iLog which lines a truck is tagged with, so a truck tagged
   * elsewhere never shows up even when it carries freight on a selected line. Here the
   * line is the question and the equipage is the answer, so tagging does not matter.
   *
   * The card itself is unchanged: the truck's whole day and one profitability
   * calculation per truck, mirrored to every card the truck appears on.
   */
  async function loadLineCardsByConsignmentLines(
    ilogDate: string,
    lines: LineItem[],
    equipages: EquipageItem[],
    loadId: number,
  ): Promise<void> {
    setUnavailableEquipageCount(0);
    setFailedLineCount(0);

    if (selectedLineIds.length === 0) {
      resetDisplayedData();
      persistEmptyResult([]);
      return;
    }

    const selectedLineIdSet = new Set(selectedLineIds);

    const approvedLines = lines
      .map((line) => ({
        ...line,
        cluster: getLineCluster(line.name) ?? "",
      }))
      .filter((line): line is LineWithEquipages => {
        return selectedLineIdSet.has(line.id);
      });

    const requestedFilterLabels = approvedLines.map((line) => line.name);
    const orientationLabels: string[] = [];

    if (approvedLines.length === 0) {
      resetDisplayedData();
      persistEmptyResult(requestedFilterLabels);
      return;
    }

    setAppliedFilterLabels(requestedFilterLabels);

    const equipageById = new Map(
      equipages.map((equipage) => [equipage.id, equipage]),
    );
    const equipageByName = new Map(
      equipages.map((equipage) => [
        normalizeEquipageName(equipage.name),
        equipage,
      ]),
    );

    // Which trucks appear on which of the selected lines, according to the bookings.
    const placementByEquipageId = new Map<
      number,
      { equipage: EquipageItem; lineIds: Set<number> }
    >();
    // Bookings whose equipage could not be identified at all.
    const unidentifiedEquipageNames = new Set<string>();
    // A line we cannot fetch takes all its trucks with it, so it must be reported.
    let failedLines = 0;

    for (const lineBatch of chunkArray(approvedLines, 4)) {
      const lineResults = await Promise.allSettled(
        lineBatch.map(async (line) => ({
          line,
          consignments: await getConsignmentsForLine(ilogDate, line),
        })),
      );

      if (latestLoadIdRef.current !== loadId) {
        return;
      }

      for (const lineResult of lineResults) {
        if (lineResult.status !== "fulfilled") {
          failedLines += 1;
          continue;
        }

        const { line, consignments } = lineResult.value;

        for (const consignment of consignments) {
          const equipage = resolveConsignmentEquipage(
            consignment,
            equipageById,
            equipageByName,
          );

          if (!equipage) {
            const rawName = consignment.equipageName.trim();
            // No equipage at all means the booking is unplanned, not a missing truck.
            if (rawName) {
              unidentifiedEquipageNames.add(normalizeEquipageName(rawName));
            }
            continue;
          }

          const placement = placementByEquipageId.get(equipage.id);

          if (placement) {
            placement.lineIds.add(line.id);
          } else {
            placementByEquipageId.set(equipage.id, {
              equipage,
              lineIds: new Set([line.id]),
            });
          }
        }
      }
    }

    setFailedLineCount(failedLines);

    const placements = Array.from(placementByEquipageId.values());
    const discoveredEquipageCount =
      placements.length + unidentifiedEquipageNames.size;

    setCandidateEquipageCount(discoveredEquipageCount);

    const approvedLineById = new Map(
      approvedLines.map((line) => [line.id, line]),
    );

    const baseEquipages: EquipageWithConsignments[] = [];
    // Tracked per equipage id so a truck placed on several lines is counted once.
    const visibleEquipageIds = new Set<number>();

    for (const placementBatch of chunkArray(placements, 6)) {
      const groupedByDirectedLine = new Map<string, LineWithEquipages>();

      const batchResults = await Promise.allSettled(
        placementBatch.map(async ({ equipage, lineIds }) => {
          // The whole day, so the card shows the truck and not just the selected lines.
          const consignments = await getIlogConsignmentsWithRetry(
            ilogDate,
            equipage.id,
          );

          if (consignments.length === 0) {
            return null;
          }

          const targetLines = Array.from(lineIds)
            .map((lineId) => approvedLineById.get(lineId))
            .filter((line): line is LineWithEquipages => Boolean(line));

          if (targetLines.length === 0) {
            return null;
          }

          // One row per equipage keeps profitability at one calculation per truck.
          const equipageRow = createEquipageRow(
            equipage,
            targetLines[0].id,
            orientLineNameForSelectedAreas(targetLines[0].name, orientationLabels),
            consignments,
          );

          return { targetLines, equipageRow };
        }),
      );

      if (latestLoadIdRef.current !== loadId) {
        return;
      }

      for (const result of batchResults) {
        if (result.status !== "fulfilled" || result.value === null) {
          continue;
        }

        const { targetLines, equipageRow } = result.value;
        baseEquipages.push(equipageRow);
        visibleEquipageIds.add(equipageRow.id);

        for (const line of targetLines) {
          const directedLineName = orientLineNameForSelectedAreas(
            line.name,
            orientationLabels,
          );
          const directedLineKey = `${line.id}|${normalizeLineName(directedLineName)}`;
          // Each card keeps its own row copy so it can show its own line name.
          const rowForLine: EquipageWithConsignments = {
            ...equipageRow,
            lineId: line.id,
            lineName: directedLineName,
          };

          const lineBucket = groupedByDirectedLine.get(directedLineKey);

          if (lineBucket) {
            lineBucket.equipages.push(rowForLine);
          } else {
            groupedByDirectedLine.set(directedLineKey, {
              ...line,
              name: directedLineName,
              equipages: [rowForLine],
            });
          }
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
      setVisibleEquipageCount(visibleEquipageIds.size);
    }

    setVisibleEquipageCount(visibleEquipageIds.size);
    // Everything found on the lines that did not make it onto a card, whatever the
    // reason: unknown equipage, a failed fetch, or no bookings left after filtering.
    setUnavailableEquipageCount(
      Math.max(0, discoveredEquipageCount - visibleEquipageIds.size),
    );

    if (visibleEquipageIds.size === 0) {
      persistEmptyResult(requestedFilterLabels);
    }

    void hydrateProfitabilityForEquipages(loadId, baseEquipages);
  }

  const loadLines = async (options?: { groupByConsignmentLines?: boolean }) => {
    // The flag is passed explicitly by the button so the run does not depend on a
    // pending setState having flushed.
    const useConsignmentLines =
      options?.groupByConsignmentLines ?? groupByConsignmentLines;
    const loadId = Date.now();
    latestLoadIdRef.current = loadId;
    setLoadingLines(true);
    setLineError("");
    setHasLoadedLines(true);
    resetDisplayedData();
    setLoadingProfitabilityCount(0);
    clearHomeCache();

    const ilogDate = toIlogDate(selectedDate);
    if (!ilogDate) {
      setLineError("Välj ett giltigt datum.");
      setLoadingLines(false);
      return;
    }

    try {
      const [linesResponse, equipagesResponse] = await Promise.all([
        getIlogLines(),
        getIlogEquipages(),
      ]);
      const lines = (linesResponse.data ?? []) as LineItem[];
      const equipages = (equipagesResponse.data ?? []) as EquipageItem[];

      if (vehicleSelectorMode === "equipages") {
        await loadEquipageCards(ilogDate, lines, equipages, loadId);
      } else if (useConsignmentLines) {
        await loadLineCardsByConsignmentLines(ilogDate, lines, equipages, loadId);
      } else {
        await loadLineCards(ilogDate, lines, equipages, loadId);
      }
    } catch {
      setLineError("Kunde inte hämta filtrerade bokningar, försök igen.");
      resetDisplayedData();
      setAppliedFilterLabels([]);
      setUnavailableEquipageCount(0);
      setFailedLineCount(0);
    } finally {
      if (latestLoadIdRef.current === loadId) {
        setLoadingLines(false);
      }
    }
  };

  const clearDisplayedLines = () => {
    latestLoadIdRef.current = Date.now();
    resetDisplayedData();
    setLoadingProfitabilityCount(0);
    setLineError("");
    setHasLoadedLines(false);
    setAppliedFilterLabels([]);
    setUnavailableEquipageCount(0);
    setFailedLineCount(0);
    clearHomeCache();
  };

  /** Refetches consignments for a specific set of equipage ids. */
  const refreshConsignmentsForEquipages = async (
    equipageIds: number[],
    ilogDate: string,
  ): Promise<EquipageWithConsignments[]> => {
    const equipageById = new Map(
      lineCards.flatMap((line) =>
        line.equipages.map((equipage) => [equipage.id, equipage]),
      ),
    );

    const refreshed: Array<EquipageWithConsignments | null> = await Promise.all(
      equipageIds.map(async (equipageId) => {
        try {
          const consignments = await getIlogConsignmentsWithRetry(ilogDate, equipageId);

          updateEquipageInState(equipageId, (current) => ({
            ...current,
            consignments,
            profitabilityStatus: "idle",
          }));

          const baseEquipage = equipageById.get(equipageId);
          if (!baseEquipage) {
            return null;
          }

          return {
            ...baseEquipage,
            consignments,
            profitabilityStatus: "idle",
          };
        } catch {
          return null;
        }
      }),
    );

    return refreshed.filter(
      (equipage): equipage is EquipageWithConsignments => equipage !== null,
    );
  };

  /** Refreshes one equipage and re-runs profitability for that subset. */
  const refreshEquipageConsignments = async (equipageId: number) => {
    const ilogDate = toIlogDate(selectedDate);
    if (!ilogDate) {
      return;
    }

    setRefreshingEquipages((current) => new Set(current).add(equipageId));

    try {
      const refreshedEquipages = await refreshConsignmentsForEquipages(
        [equipageId],
        ilogDate,
      );

      if (refreshedEquipages.length > 0) {
        const loadId = Date.now();
        latestLoadIdRef.current = loadId;
        void hydrateProfitabilityForEquipages(loadId, refreshedEquipages);
      }
    } catch {
      // Ignore refresh failures so the user can retry manually.
    } finally {
      setRefreshingEquipages((current) => {
        const next = new Set(current);
        next.delete(equipageId);
        return next;
      });
    }
  };

  /** Refreshes all equipages on a line and re-runs profitability for that subset. */
  const refreshLineConsignments = async (lineId: number) => {
    const ilogDate = toIlogDate(selectedDate);
    if (!ilogDate) {
      return;
    }

    setRefreshingLines((current) => new Set(current).add(lineId));

    try {
      const targetLine = lineCards.find((line) => line.id === lineId);
      if (!targetLine) {
        return;
      }

      const refreshedEquipages = await refreshConsignmentsForEquipages(
        targetLine.equipages.map((equipage) => equipage.id),
        ilogDate,
      );

      if (refreshedEquipages.length > 0) {
        const loadId = Date.now();
        latestLoadIdRef.current = loadId;
        void hydrateProfitabilityForEquipages(loadId, refreshedEquipages);
      }
    } catch {
      // Ignore refresh failures so the user can retry manually.
    } finally {
      setRefreshingLines((current) => {
        const next = new Set(current);
        next.delete(lineId);
        return next;
      });
    }
  };

  return {
    loadingLines,
    lineError,
    hasLoadedLines,
    setHasLoadedLines,
    refreshingEquipages,
    refreshingLines,
    unavailableEquipageCount,
    failedLineCount,
    loadLines,
    clearDisplayedLines,
    refreshEquipageConsignments,
    refreshLineConsignments,
  };
}
