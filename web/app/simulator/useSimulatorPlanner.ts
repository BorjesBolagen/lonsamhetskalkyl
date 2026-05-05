"use client";

import { useEffect, useMemo, useState } from "react";
import { getIlogConsignments, ProfitabilityValue } from "../../lib/api";
import type {
  ConsignmentListItem,
  EquipageItem,
  LineItem,
} from "../../lib/ilogTypes";
import { AreaState, DEFAULT_AREAS } from "../../lib/areaLineConfig";
import {
  buildDeliveryRouteWithStartAndStop,
  calculateBestPickupBeforeDeliveryInsertion,
  calculateConsignmentTotals,
  calculateConsignmentProfitabilityPrice,
  calculateExtraDrivingCost,
  calculateRouteDistanceKm,
  DEFAULT_PROFITABILITY_REFERENCE_VALUE,
  equipagePlacementMatchesLine,
  getCurrentTransportPlanningUserSettings,
  getDefaultNextDate,
  getDisplayCustomerName,
  getEquipageLinePlacement,
  getFilteredLinesAndEquipagesForAreas,
  getSelectedAreaLabels,
  parseTaxPointRelation,
  safeGetSessionStorageJson,
  safeSetSessionStorageJson,
  toIlogDate,
} from "../../lib/backend/transportPlanningUtils";

const SIMULATOR_CACHE_KEY = "simulator-cache-v8";

// Ändra till ert faktiska milpris.
const MILPRIS_PER_MIL = 100;

type SimulatorLine = LineItem & {
  cluster: string;
};

type SimulatedConsignment = ConsignmentListItem & {
  simulatedProfitability?: ProfitabilityValue | null;
  revenueMatchStep?: number | null;
  extraDistanceKm?: number | null;
  extraDrivingCost?: number | null;
  originalRouteDistanceKm?: number | null;
  optimizedRouteDistanceKm?: number | null;
  optimizedRouteStops?: string[] | null;
  insertionPickupIndex?: number | null;
  insertionDeliveryIndex?: number | null;
};

type CurrentEquipageSummary = {
  consignments: ConsignmentListItem[];
  totalFlm: number;
  totalWeightKg: number;
};

type SimulatorCachePayload = {
  selectedDate: string;
  selectedLineId: number | null;
  selectedEquipageId: number | null;
  selectedConsignmentIds: number[];
  unassignedConsignments: SimulatedConsignment[];
};

type DistanceLookupResponse = {
  status: boolean;
  message: string;
  data?: {
    sender: number;
    receiver: number;
    distanceKm: number | null;
  };
};

/**
 * Hämtar oplacerade bokningar för vald linje och datum.
 */
async function getIlogUnassignedConsignments(
  date: string,
  lineId: number,
  lineType: "ZONE" | "ZONEFILTER" | "ZONEGROUP",
) {
  const response = await fetch(
    `/api/ilog/unassigned-consignments?date=${encodeURIComponent(
      date,
    )}&lineId=${lineId}&lineType=${encodeURIComponent(lineType)}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  return response.json();
}

/**
 * Hämtar avstånd mellan två taxepunkter via distance_map-routen.
 */
async function getDistanceKmBetweenTaxPoints(
  sender: string,
  receiver: string,
): Promise<number | null> {
  const taxPointRelation = `${sender}-${receiver}`;

  const response = await fetch(
    `/api/distance-map?taxPointRelation=${encodeURIComponent(
      taxPointRelation,
    )}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  const rawText = await response.text();

  let result: DistanceLookupResponse;

  try {
    result = JSON.parse(rawText) as DistanceLookupResponse;
  } catch {
    throw new Error(
      `Distance route returnerade inte JSON: ${rawText.slice(0, 200)}`,
    );
  }

  if (!response.ok) {
    throw new Error(result.message || "Distance route returnerade fel.");
  }

  if (!result.status || !result.data) {
    return null;
  }

  return typeof result.data.distanceKm === "number"
    ? result.data.distanceKm
    : null;
}

/**
 * Hook för simulatorns state, laddning, cache och ruttinsättning med pickup före delivery.
 */
export function useSimulatorPlanner() {
  const [selectedAreas, setSelectedAreas] = useState<AreaState>(DEFAULT_AREAS);
  const [areasLoaded, setAreasLoaded] = useState(false);
  const [profitabilityReferenceValue, setProfitabilityReferenceValue] =
    useState<number>(DEFAULT_PROFITABILITY_REFERENCE_VALUE);

  const [selectedDate, setSelectedDate] = useState(getDefaultNextDate);

  // Alla möjliga linjer efter klusterfilter.
  const [availableLines, setAvailableLines] = useState<SimulatorLine[]>([]);

  // Endast linjer som faktiskt får ekipage enligt samma placeringslogik som Home.
  const [homeVisibleLines, setHomeVisibleLines] = useState<SimulatorLine[]>([]);

  const [filteredAreaEquipages, setFilteredAreaEquipages] = useState<
    EquipageItem[]
  >([]);
  const [availableEquipages, setAvailableEquipages] = useState<EquipageItem[]>(
    [],
  );

  const [selectedLineId, setSelectedLineId] = useState<number | null>(null);
  const [selectedEquipageId, setSelectedEquipageId] = useState<number | null>(
    null,
  );

  const [unassignedConsignments, setUnassignedConsignments] = useState<
    SimulatedConsignment[]
  >([]);
  const [selectedConsignmentIds, setSelectedConsignmentIds] = useState<
    number[]
  >([]);

  const [currentEquipageSummary, setCurrentEquipageSummary] =
    useState<CurrentEquipageSummary | null>(null);

  const [isLoadingLines, setIsLoadingLines] = useState(false);
  const [isLoadingEquipages, setIsLoadingEquipages] = useState(false);
  const [isLoadingUnassigned, setIsLoadingUnassigned] = useState(false);
  const [isLoadingCurrentEquipage, setIsLoadingCurrentEquipage] =
    useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const selectedAreaLabels = useMemo(
    () => getSelectedAreaLabels(selectedAreas),
    [selectedAreas],
  );

  const selectedLine = useMemo(
    () => homeVisibleLines.find((line) => line.id === selectedLineId) ?? null,
    [homeVisibleLines, selectedLineId],
  );

  const selectedEquipage = useMemo(
    () =>
      availableEquipages.find(
        (equipage) => equipage.id === selectedEquipageId,
      ) ?? null,
    [availableEquipages, selectedEquipageId],
  );

  const selectedConsignments = useMemo(
    () =>
      unassignedConsignments.filter((consignment) =>
        selectedConsignmentIds.includes(consignment.consignmentId),
      ),
    [unassignedConsignments, selectedConsignmentIds],
  );

  const simulationSummary = useMemo(() => {
    const addedWeightKg = selectedConsignments.reduce(
      (sum, consignment) => sum + (consignment.weight ?? 0),
      0,
    );

    const addedFlm = selectedConsignments.reduce(
      (sum, consignment) => sum + (consignment.flm ?? 0),
      0,
    );

    const totalExtraDistanceKm = selectedConsignments.reduce(
      (sum, consignment) => sum + (consignment.extraDistanceKm ?? 0),
      0,
    );

    const totalExtraDrivingCost = selectedConsignments.reduce(
      (sum, consignment) => sum + (consignment.extraDrivingCost ?? 0),
      0,
    );

    const totalEstimatedRevenue = selectedConsignments.reduce(
      (sum, consignment) =>
        sum + (consignment.simulatedProfitability?.estimated_revenue ?? 0),
      0,
    );

    const simulatedMargin = totalEstimatedRevenue - totalExtraDrivingCost;

    const currentFlm = currentEquipageSummary?.totalFlm ?? 0;
    const simulatedFlm = currentFlm + addedFlm;

    return {
      addedWeightKg,
      addedFlm,
      totalExtraDistanceKm,
      totalExtraDrivingCost,
      totalEstimatedRevenue,
      simulatedMargin,
      currentFlm,
      simulatedFlm,
    };
  }, [currentEquipageSummary, selectedConsignments]);

  /**
   * Sparar simulatorns state i sessionStorage.
   */
  function persistSimulatorCache(payload: SimulatorCachePayload): void {
    safeSetSessionStorageJson(SIMULATOR_CACHE_KEY, payload);
  }

  /**
   * Byter datum och nollställer beroende val.
   */
  function handleDateChange(value: string) {
    setSelectedDate(value);
    setSelectedLineId(null);
    setSelectedEquipageId(null);
    setSelectedConsignmentIds([]);
    setUnassignedConsignments([]);
    setCurrentEquipageSummary(null);
  }

  /**
   * Byter linje och nollställer beroende val.
   */
  function handleLineChange(lineId: number | null) {
    setSelectedLineId(lineId);
    setSelectedEquipageId(null);
    setSelectedConsignmentIds([]);
    setUnassignedConsignments([]);
    setCurrentEquipageSummary(null);
  }

  /**
   * Byter ekipage.
   */
  function handleEquipageChange(equipageId: number | null) {
    setSelectedEquipageId(equipageId);
  }

  /**
   * Markerar eller avmarkerar bokning.
   */
  function toggleConsignment(consignmentId: number) {
    setSelectedConsignmentIds((current) =>
      current.includes(consignmentId)
        ? current.filter((id) => id !== consignmentId)
        : [...current, consignmentId],
    );
  }

  /**
   * Hämtar intäkt med samma profitability-logik som Home.
   */
  async function calculateRevenueLikeHome(
    consignment: ConsignmentListItem,
  ): Promise<{
    simulatedProfitability: ProfitabilityValue | null;
    revenueMatchStep: number | null;
  }> {
    const simulatedProfitability =
      await calculateConsignmentProfitabilityPrice(consignment);

    return {
      simulatedProfitability,
      revenueMatchStep: simulatedProfitability?.step_used ?? null,
    };
  }

  /**
   * Simulerar valda bokningar med start/stop från valt ekipages befintliga consignments.
   *
   * iLog ger inte separat start-/slutpunkt för ekipaget. Därför byggs originalrutten
   * från valt ekipages consignments:
   * - start = sender i första befintliga taxPointRelation
   * - stop = receiver i sista befintliga taxPointRelation
   *
   * För varje ny bokning testas bästa placering där pickup alltid ligger före delivery.
   */
  async function runSimulation() {
    if (!selectedEquipageId) {
      setErrorMsg("Välj ett ekipage att simulera på.");
      return;
    }

    if (!currentEquipageSummary) {
      setErrorMsg("Ekipagets nuvarande bokningar har inte laddats.");
      return;
    }

    if (selectedConsignmentIds.length === 0) {
      setErrorMsg("Välj minst en bokning att simulera.");
      return;
    }

    setErrorMsg("");
    setIsSimulating(true);

    try {
      const selectedIdSet = new Set(selectedConsignmentIds);
      const distanceCache = new Map<string, number | null>();

      async function getCachedDistanceKm(
        sender: string,
        receiver: string,
      ): Promise<number | null> {
        const forwardKey = `${sender}-${receiver}`;
        const reverseKey = `${receiver}-${sender}`;

        if (distanceCache.has(forwardKey)) {
          return distanceCache.get(forwardKey) ?? null;
        }

        if (distanceCache.has(reverseKey)) {
          return distanceCache.get(reverseKey) ?? null;
        }

        const distanceKm = await getDistanceKmBetweenTaxPoints(sender, receiver);
        distanceCache.set(forwardKey, distanceKm);
        return distanceKm;
      }

      let currentRouteStops = buildDeliveryRouteWithStartAndStop(
        currentEquipageSummary.consignments,
      );

      let currentRouteDistanceKm = await calculateRouteDistanceKm(
        currentRouteStops,
        getCachedDistanceKm,
      );

      const simulatedById = new Map<number, SimulatedConsignment>();

      for (const consignment of unassignedConsignments) {
        if (!selectedIdSet.has(consignment.consignmentId)) {
          continue;
        }

        const parsed = parseTaxPointRelation(consignment.taxPointRelation);

        if (!parsed) {
          simulatedById.set(consignment.consignmentId, {
            ...consignment,
            simulatedProfitability: null,
            revenueMatchStep: null,
            extraDistanceKm: null,
            extraDrivingCost: null,
            originalRouteDistanceKm: null,
            optimizedRouteDistanceKm: null,
            optimizedRouteStops: null,
            insertionPickupIndex: null,
            insertionDeliveryIndex: null,
          });
          continue;
        }

        const routeResult = await calculateBestPickupBeforeDeliveryInsertion(
          currentRouteStops,
          currentRouteDistanceKm,
          parsed.sender,
          parsed.receiver,
          getCachedDistanceKm,
        );

        const extraDrivingCost = calculateExtraDrivingCost(
          routeResult.extraDistanceKm,
          MILPRIS_PER_MIL,
        );

        const { simulatedProfitability, revenueMatchStep } =
          await calculateRevenueLikeHome(consignment);

        currentRouteStops = routeResult.optimizedStops;
        currentRouteDistanceKm = routeResult.optimizedDistanceKm;

        simulatedById.set(consignment.consignmentId, {
          ...consignment,
          simulatedProfitability,
          revenueMatchStep,
          extraDistanceKm: routeResult.extraDistanceKm,
          extraDrivingCost,
          originalRouteDistanceKm: routeResult.originalDistanceKm,
          optimizedRouteDistanceKm: routeResult.optimizedDistanceKm,
          optimizedRouteStops: routeResult.optimizedStops,
          insertionPickupIndex: routeResult.pickupIndex,
          insertionDeliveryIndex: routeResult.deliveryIndex,
        });
      }

      setUnassignedConsignments((current) =>
        current.map((consignment) =>
          simulatedById.get(consignment.consignmentId) ?? consignment,
        ),
      );
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? `Kunde inte simulera bokningarna: ${error.message}`
          : "Kunde inte simulera bokningarna.",
      );
    } finally {
      setIsSimulating(false);
    }
  }

  /**
   * Rensar valda bokningar och simulerade ruttvärden.
   */
  function clearSimulationSelection() {
    setSelectedConsignmentIds([]);
    setUnassignedConsignments((current) =>
      current.map((consignment) => ({
        ...consignment,
        simulatedProfitability: undefined,
        revenueMatchStep: undefined,
        extraDistanceKm: undefined,
        extraDrivingCost: undefined,
        originalRouteDistanceKm: undefined,
        optimizedRouteDistanceKm: undefined,
        optimizedRouteStops: undefined,
        insertionPickupIndex: undefined,
        insertionDeliveryIndex: undefined,
      })),
    );
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
    const cached =
      safeGetSessionStorageJson<SimulatorCachePayload>(SIMULATOR_CACHE_KEY);

    if (cached) {
      setSelectedDate(cached.selectedDate || getDefaultNextDate());
      setSelectedLineId(cached.selectedLineId ?? null);
      setSelectedEquipageId(cached.selectedEquipageId ?? null);
      setSelectedConsignmentIds(cached.selectedConsignmentIds ?? []);
      setUnassignedConsignments(cached.unassignedConsignments ?? []);
    }

    setHasHydrated(true);
  }, []);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    persistSimulatorCache({
      selectedDate,
      selectedLineId,
      selectedEquipageId,
      selectedConsignmentIds,
      unassignedConsignments,
    });
  }, [
    hasHydrated,
    selectedDate,
    selectedLineId,
    selectedEquipageId,
    selectedConsignmentIds,
    unassignedConsignments,
  ]);

  useEffect(() => {
    async function loadLinesAndAreaEquipages() {
      if (!areasLoaded) {
        return;
      }

      setIsLoadingLines(true);
      setIsLoadingEquipages(true);
      setErrorMsg("");

      try {
        const { approvedLines, filteredEquipages } =
          await getFilteredLinesAndEquipagesForAreas(selectedAreaLabels);

        setAvailableLines(approvedLines as SimulatorLine[]);
        setFilteredAreaEquipages(filteredEquipages);
      } catch {
        setErrorMsg("Kunde inte hämta linjer och ekipage.");
        setAvailableLines([]);
        setHomeVisibleLines([]);
        setFilteredAreaEquipages([]);
      } finally {
        setIsLoadingLines(false);
        setIsLoadingEquipages(false);
      }
    }

    loadLinesAndAreaEquipages();
  }, [areasLoaded, selectedAreaLabels]);

useEffect(() => {
  async function loadHomeVisibleLines() {
    if (
      !selectedDate ||
      availableLines.length === 0 ||
      filteredAreaEquipages.length === 0
    ) {
      setHomeVisibleLines([]);
      return;
    }

    const ilogDate = toIlogDate(selectedDate);
    if (!ilogDate) {
      setHomeVisibleLines([]);
      return;
    }

    setIsLoadingLines(true);
    setErrorMsg("");

    try {
      const visibleLineMap = new Map<number, SimulatorLine>();

      await Promise.all(
        filteredAreaEquipages.map(async (equipage) => {
          const response = await getIlogConsignments(ilogDate, equipage.id);
          const consignments = (response.data ?? []) as ConsignmentListItem[];

          const placement = getEquipageLinePlacement(
            equipage,
            consignments,
            availableLines,
            selectedAreaLabels,
          );

          if (!placement) {
            return;
          }

          visibleLineMap.set(
            placement.displayLine.id,
            placement.displayLine as SimulatorLine,
          );
        }),
      );

      const visibleLines = Array.from(visibleLineMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name, "sv"),
      );

      setHomeVisibleLines(visibleLines);

      if (
        selectedLineId &&
        !visibleLines.some((line) => line.id === selectedLineId)
      ) {
        setSelectedLineId(null);
        setSelectedEquipageId(null);
        setSelectedConsignmentIds([]);
        setUnassignedConsignments([]);
        setCurrentEquipageSummary(null);
      }
    } catch {
      setErrorMsg("Kunde inte kontrollera synliga linjer.");
      setHomeVisibleLines([]);
    } finally {
      setIsLoadingLines(false);
    }
  }

  loadHomeVisibleLines();
}, [
  availableLines,
  filteredAreaEquipages,
  selectedAreaLabels,
  selectedDate,
]);

  useEffect(() => {
    async function loadEquipagesForSelectedLineUsingHomeLogic() {
      if (!selectedLine || !selectedDate) {
        setAvailableEquipages([]);
        return;
      }

      const ilogDate = toIlogDate(selectedDate);
      if (!ilogDate) {
        setAvailableEquipages([]);
        return;
      }

      setIsLoadingEquipages(true);
      setErrorMsg("");

      try {
        const checkedEquipages = await Promise.all(
          filteredAreaEquipages.map(async (equipage) => {
            const response = await getIlogConsignments(ilogDate, equipage.id);
            const consignments = (response.data ?? []) as ConsignmentListItem[];

            const placement = getEquipageLinePlacement(
              equipage,
              consignments,
              availableLines,
              selectedAreaLabels,
            );

            if (!placement) {
              return null;
            }

            return equipagePlacementMatchesLine(placement, selectedLine)
              ? equipage
              : null;
          }),
        );

        const filtered = checkedEquipages
          .filter((equipage): equipage is EquipageItem => equipage !== null)
          .sort((a, b) => a.name.localeCompare(b.name, "sv"));

        setAvailableEquipages(filtered);
      } catch {
        setErrorMsg("Kunde inte kontrollera ekipage för vald linje.");
        setAvailableEquipages([]);
      } finally {
        setIsLoadingEquipages(false);
      }
    }

    loadEquipagesForSelectedLineUsingHomeLogic();
  }, [
    availableLines,
    filteredAreaEquipages,
    selectedAreaLabels,
    selectedLine,
    selectedDate,
  ]);

  useEffect(() => {
    if (
      selectedEquipageId &&
      !availableEquipages.some((equipage) => equipage.id === selectedEquipageId)
    ) {
      setSelectedEquipageId(null);
      setCurrentEquipageSummary(null);
    }
  }, [availableEquipages, selectedEquipageId]);

  useEffect(() => {
    async function loadUnassignedConsignments() {
      if (!hasHydrated) {
        return;
      }

      if (!selectedLine || !selectedDate) {
        setUnassignedConsignments([]);
        setSelectedConsignmentIds([]);
        return;
      }

      const ilogDate = toIlogDate(selectedDate);
      if (!ilogDate) {
        return;
      }

      setIsLoadingUnassigned(true);
      setErrorMsg("");

      try {
        const response = await getIlogUnassignedConsignments(
          ilogDate,
          selectedLine.id,
          selectedLine.type as "ZONE" | "ZONEFILTER" | "ZONEGROUP",
        );

        if (!response.status) {
          setErrorMsg(
            response.message || "Kunde inte hämta oplacerade bokningar.",
          );
          setUnassignedConsignments([]);
          setSelectedConsignmentIds([]);
          return;
        }

        const incoming = (response.data ?? []) as SimulatedConsignment[];

        const previousMap = new Map(
          unassignedConsignments.map((consignment) => [
            consignment.consignmentId,
            consignment,
          ]),
        );

        const merged = incoming.map((consignment) => {
          const previous = previousMap.get(consignment.consignmentId);

          return previous
            ? {
                ...consignment,
                simulatedProfitability: previous.simulatedProfitability,
                revenueMatchStep: previous.revenueMatchStep,
                extraDistanceKm: previous.extraDistanceKm,
                extraDrivingCost: previous.extraDrivingCost,
                originalRouteDistanceKm: previous.originalRouteDistanceKm,
                optimizedRouteDistanceKm: previous.optimizedRouteDistanceKm,
                optimizedRouteStops: previous.optimizedRouteStops,
                insertionPickupIndex: previous.insertionPickupIndex,
                insertionDeliveryIndex: previous.insertionDeliveryIndex,
              }
            : consignment;
        });

        setUnassignedConsignments(merged);

        setSelectedConsignmentIds((current) =>
          current.filter((id) =>
            merged.some((consignment) => consignment.consignmentId === id),
          ),
        );
      } catch {
        setErrorMsg("Kunde inte hämta oplacerade bokningar.");
      } finally {
        setIsLoadingUnassigned(false);
      }
    }

    loadUnassignedConsignments();
  }, [hasHydrated, selectedLine, selectedDate]);

  useEffect(() => {
    async function loadCurrentEquipage() {
      if (!selectedEquipageId || !selectedDate) {
        setCurrentEquipageSummary(null);
        return;
      }

      const ilogDate = toIlogDate(selectedDate);
      if (!ilogDate) {
        return;
      }

      setIsLoadingCurrentEquipage(true);
      setErrorMsg("");

      try {
        const response = await getIlogConsignments(
          ilogDate,
          selectedEquipageId,
        );
        const consignments = (response.data ?? []) as ConsignmentListItem[];
        const totals = calculateConsignmentTotals(consignments);

        setCurrentEquipageSummary({
          consignments,
          totalWeightKg: totals.totalWeightKg,
          totalFlm: totals.totalFlm,
        });
      } catch {
        setErrorMsg("Kunde inte hämta bokningar för valt ekipage.");
      } finally {
        setIsLoadingCurrentEquipage(false);
      }
    }

    loadCurrentEquipage();
  }, [selectedEquipageId, selectedDate]);

  return {
    selectedDate,
    setSelectedDate: handleDateChange,
    profitabilityReferenceValue,
    availableLines: homeVisibleLines,
    selectedLineId,
    setSelectedLineId: handleLineChange,
    selectedLine,
    availableEquipages,
    selectedEquipageId,
    setSelectedEquipageId: handleEquipageChange,
    selectedEquipage,
    unassignedConsignments,
    selectedConsignmentIds,
    selectedConsignments,
    toggleConsignment,
    clearSimulationSelection,
    currentEquipageSummary,
    simulationSummary,
    runSimulation,
    getDisplayCustomerName,
    areasLoaded,
    isLoadingLines,
    isLoadingEquipages,
    isLoadingUnassigned,
    isLoadingCurrentEquipage,
    isSimulating,
    errorMsg,
    milprisPerMil: MILPRIS_PER_MIL,
  };
}
