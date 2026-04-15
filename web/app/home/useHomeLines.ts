"use client";

import {
  getCurrentlySignedInUser,
  getIlogConsignments,
  getIlogEquipages,
  getIlogLines,
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
import { useEffect, useMemo, useState } from "react";

const HOME_CACHE_KEY = "home-lines-cache-v6";

function getDefaultHomeDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const day = String(tomorrow.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type EquipageWithConsignments = {
  id: number;
  name: string;
  lineId: number;
  lineName: string;
  consignments: ConsignmentListItem[];
  totalWeightKg: number;
  totalFlm: number;
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

function ensureEquipageTotals(
  equipage: EquipageWithConsignments,
): EquipageWithConsignments {
  // Some cached entries might miss totals; derive from consignments as fallback.
  const totalWeightKg =
    equipage.totalWeightKg ??
    equipage.consignments.reduce(
      (sum, consignment) => sum + (consignment.weight ?? 0),
      0,
    );

  const totalFlm =
    equipage.totalFlm ??
    equipage.consignments.reduce(
      (sum, consignment) => sum + (consignment.flm ?? 0),
      0,
    );

  return {
    ...equipage,
    totalWeightKg,
    totalFlm,
  };
}

function normalizeLineCards(
  lineCards: LineWithEquipages[],
): LineWithEquipages[] {
  return lineCards.map((line) => ({
    ...line,
    equipages: line.equipages.map((equipage) => ensureEquipageTotals(equipage)),
  }));
}

function toIlogDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  return value.replace(/-/g, "");
}

function splitLineParts(lineName: string): string[] {
  return lineName
    .replace(/\(avd:[^)]+\)/gi, "")
    .split(/\s*-\s*/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

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

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

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

function pickTrailingNamePart(rawValue: string): string | null {
  const value = rawValue
    .trim()
    .split("*")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .at(-1);

  return value && value.length > 0 ? value : null;
}

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

export function useHomeLines() {
  const [selectedAreas, setSelectedAreas] = useState<AreaState>(DEFAULT_AREAS);
  const [areasLoaded, setAreasLoaded] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getDefaultHomeDate);

  const [lineCards, setLineCards] = useState<LineWithEquipages[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);
  const [lineError, setLineError] = useState("");
  const [hasLoadedLines, setHasLoadedLines] = useState(false);
  const [candidateEquipageCount, setCandidateEquipageCount] = useState(0);
  const [visibleEquipageCount, setVisibleEquipageCount] = useState(0);

  const [selectedEquipage, setSelectedEquipage] =
    useState<EquipageWithConsignments | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [appliedClusterLabels, setAppliedClusterLabels] = useState<string[]>(
    [],
  );

  const selectedAreaLabels = useMemo(
    () =>
      Object.entries(selectedAreas)
        .filter(([, isActive]) => isActive)
        .map(([areaKey]) => AREA_OPTIONS[areaKey as AreaKey]),
    [selectedAreas],
  );

  const normalizedSelectedClusters = useMemo(
    () => new Set(selectedAreaLabels.map((label) => normalizeText(label))),
    [selectedAreaLabels],
  );

  function lineMatchesSelectedAreas(clusterName: string): boolean {
    if (normalizedSelectedClusters.size === 0) {
      return false;
    }

    return normalizedSelectedClusters.has(normalizeText(clusterName));
  }

  function resetDisplayedData(): void {
    setLineCards([]);
    setCandidateEquipageCount(0);
    setVisibleEquipageCount(0);
    setSelectedEquipage(null);
    setIsDetailsOpen(false);
  }

  useEffect(() => {
    // Load persisted user cluster preferences once on mount.
    async function loadCurrentUserSettings() {
      try {
        const response = await getCurrentlySignedInUser();
        const user = response.data;

        if (user) {
          setSelectedAreas(parseAreaState(user.filters));
        } else {
          setSelectedAreas(DEFAULT_AREAS);
        }
      } catch {
        setSelectedAreas(DEFAULT_AREAS);
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
      // Restore last fetched Home result to avoid refetch on quick navigation.
      const raw = sessionStorage.getItem(HOME_CACHE_KEY);
      if (!raw) {
        return;
      }

      const cached = JSON.parse(raw) as HomeCachePayload;
      if (!cached || !Array.isArray(cached.lineCards)) {
        return;
      }

      const normalizedLineCards = normalizeLineCards(cached.lineCards);

      setSelectedDate(cached.selectedDate || getDefaultHomeDate());
      setLineCards(normalizedLineCards);
      setHasLoadedLines(true);
      setCandidateEquipageCount(cached.candidateEquipageCount ?? 0);
      setVisibleEquipageCount(cached.visibleEquipageCount ?? 0);
      setAppliedClusterLabels(cached.appliedClusterLabels ?? []);
    } catch {
      // ignore malformed cache
    }
  }, [areasLoaded]);

  function persistHomeCache(payload: HomeCachePayload): void {
    try {
      sessionStorage.setItem(HOME_CACHE_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage errors
    }
  }

  function clearHomeCache(): void {
    try {
      sessionStorage.removeItem(HOME_CACHE_KEY);
    } catch {
      // ignore storage errors
    }
  }

  const loadLines = async () => {
    try {
      const requestedClusterLabels = [...selectedAreaLabels];
      setLoadingLines(true);
      setLineError("");
      setHasLoadedLines(true);

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
      // iLog kan returnera dubletter; dedupe by equipage ID during selection.
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

      const groupedByDirectedLine = new Map<string, LineWithEquipages>();

      // Step 3: fetch consignments in batches and build display rows.
      for (const equipageBatch of chunkArray(filteredEquipages, 6)) {
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
              lineId: displayLine.id,
              lineName: directedLineName,
              consignments: visibleConsignments,
              totalWeightKg: visibleConsignments.reduce(
                (sum, consignment) => sum + (consignment.weight ?? 0),
                0,
              ),
              totalFlm: visibleConsignments.reduce(
                (sum, consignment) => sum + (consignment.flm ?? 0),
                0,
              ),
            };

            return {
              displayLine,
              directedLineName,
              equipageRow,
            };
          }),
        );

        for (const result of batchResults) {
          if (result.status !== "fulfilled" || result.value === null) {
            continue;
          }

          const { displayLine, directedLineName, equipageRow } = result.value;
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
      }

      const nonEmptyLines = Array.from(groupedByDirectedLine.values())
        .map((line) => ({
          ...line,
          equipages: line.equipages.sort((a, b) =>
            a.name.localeCompare(b.name, "sv"),
          ),
        }))
        .filter((line) => line.equipages.length > 0)
        .sort((a, b) => a.name.localeCompare(b.name, "sv"));

      const visibleCount = nonEmptyLines.reduce(
        (sum, line) => sum + line.equipages.length,
        0,
      );

      setLineCards(nonEmptyLines);
      setVisibleEquipageCount(visibleCount);
      setAppliedClusterLabels(requestedClusterLabels);
      // Persist exactly what is shown so summary text matches visible cards.
      persistHomeCache({
        selectedDate,
        lineCards: nonEmptyLines,
        candidateEquipageCount: filteredEquipages.length,
        visibleEquipageCount: visibleCount,
        appliedClusterLabels: requestedClusterLabels,
      });
    } catch {
      setLineError("Kunde inte hämta filtrerade linjer, försök igen.");
      resetDisplayedData();
      setAppliedClusterLabels([]);
    } finally {
      setLoadingLines(false);
    }
  };

  const openDetails = (equipage: EquipageWithConsignments) => {
    setSelectedEquipage(ensureEquipageTotals(equipage));
    setIsDetailsOpen(true);
  };

  const closeDetails = () => setIsDetailsOpen(false);

  const clearDisplayedLines = () => {
    resetDisplayedData();
    setLineError("");
    setHasLoadedLines(false);
    setAppliedClusterLabels([]);
    clearHomeCache();
  };

  return {
    selectedDate,
    setSelectedDate,
    lineCards,
    loadingLines,
    lineError,
    hasLoadedLines,
    candidateEquipageCount,
    visibleEquipageCount,
    appliedClusterLabels,
    selectedAreaLabels,
    selectedEquipage,
    isDetailsOpen,
    areasLoaded,
    loadLines,
    clearDisplayedLines,
    openDetails,
    closeDetails,
  };
}
