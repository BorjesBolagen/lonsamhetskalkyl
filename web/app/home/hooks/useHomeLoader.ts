"use client";

import { useMemo, useState } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { getIlogEquipages, getIlogLines } from "../../../lib/api";
import type { EquipageItem, LineItem } from "../../../lib/ilogTypes";
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
} from "./homeTypesAndUtils";

type UseHomeLoaderParams = {
  selectedDate: string;
  selectedAreaLabels: string[];
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
  setAppliedClusterLabels: Dispatch<SetStateAction<string[]>>;
};

/**
 * Handles Home data loading and refresh flows for lines/equipages/consignments.
 */
export function useHomeLoader({
  selectedDate,
  selectedAreaLabels,
  lineCards,
  setLineCards,
  setCandidateEquipageCount,
  setVisibleEquipageCount,
  setLoadingProfitabilityCount,
  latestLoadIdRef,
  resetDisplayedData,
  mergeLineBatchIntoState,
  updateEquipageInState,
  hydrateProfitabilityForEquipages,
  setAppliedClusterLabels,
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

  const normalizedSelectedClusters = useMemo(
    () => new Set(selectedAreaLabels.map((label) => normalizeText(label))),
    [selectedAreaLabels],
  );

  /** Returns true when a line cluster is part of current selected cluster labels. */
  function lineMatchesSelectedAreas(clusterName: string): boolean {
    if (normalizedSelectedClusters.size === 0) {
      return false;
    }

    return normalizedSelectedClusters.has(normalizeText(clusterName));
  }

  const loadLines = async () => {
    // Monotonic load id prevents stale async responses from replacing newer results.
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

      // Step 1: keep only lines that are mappable and match selected clusters.
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

      // Step 2: keep only equipages that link to approved lines (id or normalized name).
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

      // Step 3: fetch consignments in batches and incrementally merge into displayed cards.
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
                normalizeLineName(line.name) === normalizeLineName(dominantLineName),
            );
            const displayLine = dominantLine ?? baseLine;
            const directedLineName = orientLineNameForSelectedAreas(
              displayLine.name,
              requestedClusterLabels,
            );

            const equipageRow: EquipageWithConsignments = {
              id: equipage.id,
              name: equipage.name,
              lineId: displayLine.id,
              lineName: directedLineName,
              consignments: visibleConsignments,
              totalWeightKg: visibleConsignments.reduce(
                (sum, consignment) => sum + (consignment.weight ?? 0),
                0,
              ),
              totalFlm: visibleConsignments.reduce(
                (sum, consignment) => sum + getConsignmentFlm(consignment),
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
      // Profitability hydration runs after initial card render for faster first paint.
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

  const clearDisplayedLines = () => {
    latestLoadIdRef.current = Date.now();
    resetDisplayedData();
    setLoadingProfitabilityCount(0);
    setLineError("");
    setHasLoadedLines(false);
    setAppliedClusterLabels([]);
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
    loadLines,
    clearDisplayedLines,
    refreshEquipageConsignments,
    refreshLineConsignments,
  };
}
