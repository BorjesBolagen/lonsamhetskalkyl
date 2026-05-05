"use client";

import { useEffect, useMemo, useState } from "react";
import { getIlogConsignments } from "../../lib/api";
import type { ProfitabilityValue } from "../../lib/api";
import type {
  ConsignmentListItem,
  EquipageItem,
  LineItem,
} from "../../lib/ilogTypes";
import { DEFAULT_AREAS } from "../../lib/areaLineConfig";
import type { AreaState } from "../../lib/areaLineConfig";
import {
  buildDeliveryRouteWithStartAndStop,
  calculateBestPickupBeforeDeliveryInsertion,
  calculateConsignmentTotals,
  calculateConsignmentProfitabilityPrice,
  calculateExtraDrivingCost,
  calculateRouteDistanceKm,
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
import {
  DEFAULT_MILE_COST,
  DEFAULT_PROFITABILITY_REFERENCE_VALUE,
} from "../../lib/backend/constants";

const SIMULATOR_CACHE_KEY = "simulator-cache-v9";
const FICTITIOUS_TAX_POINT_RELATION_PATTERN = /^\d{5}-\d{5}$/;

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
  missingDistanceRelation?: string | null;
};

export type FictitiousBooking = {
  id: string;
  taxPointRelation: string;
  price: number;
  simulatedProfitability?: ProfitabilityValue | null;
  revenueMatchStep?: number | null;
  extraDistanceKm?: number | null;
  extraDrivingCost?: number | null;
  originalRouteDistanceKm?: number | null;
  optimizedRouteDistanceKm?: number | null;
  optimizedRouteStops?: string[] | null;
  insertionPickupIndex?: number | null;
  insertionDeliveryIndex?: number | null;
  missingDistanceRelation?: string | null;
};

export type NewFictitiousBookingInput = {
  taxPointRelation: string;
  price: string | number;
};

export type AddFictitiousBookingFieldErrors = {
  taxPointRelation?: string;
  price?: string;
};

export type AddFictitiousBookingResult =
  | { success: true }
  | {
      success: false;
      fieldErrors: AddFictitiousBookingFieldErrors;
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
  selectedFictitiousBookingIds: string[];
  unassignedConsignments: SimulatedConsignment[];
  fictitiousBookings: FictitiousBooking[];
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

function normalizeFictitiousTaxPointRelation(value: string): string {
  return value.trim().replace(/\s+/g, "");
}

function hasSimulationResult(
  item: SimulatedConsignment | FictitiousBooking,
): boolean {
  return (
    item.extraDistanceKm !== undefined ||
    item.extraDrivingCost !== undefined ||
    item.simulatedProfitability !== undefined ||
    item.missingDistanceRelation !== undefined
  );
}

export function useSimulatorPlanner() {
  const [selectedAreas, setSelectedAreas] = useState<AreaState>(DEFAULT_AREAS);
  const [areasLoaded, setAreasLoaded] = useState(false);
  const [profitabilityReferenceValue, setProfitabilityReferenceValue] =
    useState<number>(DEFAULT_PROFITABILITY_REFERENCE_VALUE);
  const [mileCostReferenceValue, setMileCostReferenceValue] =
    useState<number>(DEFAULT_MILE_COST);

  const [selectedDate, setSelectedDate] = useState(getDefaultNextDate);
  const [availableLines, setAvailableLines] = useState<SimulatorLine[]>([]);
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
  const [fictitiousBookings, setFictitiousBookings] = useState<
    FictitiousBooking[]
  >([]);
  const [selectedFictitiousBookingIds, setSelectedFictitiousBookingIds] =
    useState<string[]>([]);

  const [currentEquipageSummary, setCurrentEquipageSummary] =
    useState<CurrentEquipageSummary | null>(null);

  const [isLoadingLines, setIsLoadingLines] = useState(false);
  const [isLoadingEquipages, setIsLoadingEquipages] = useState(false);
  const [isLoadingUnassigned, setIsLoadingUnassigned] = useState(false);
  const [isLoadingCurrentEquipage, setIsLoadingCurrentEquipage] =
    useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isAddingFictitiousBooking, setIsAddingFictitiousBooking] =
    useState(false);
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

  const selectedFictitiousBookings = useMemo(
    () =>
      fictitiousBookings.filter((booking) =>
        selectedFictitiousBookingIds.includes(booking.id),
      ),
    [fictitiousBookings, selectedFictitiousBookingIds],
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

    const selectedItems = [
      ...selectedConsignments,
      ...selectedFictitiousBookings,
    ];

    const calculatedItems = selectedItems.filter(
      (item) => hasSimulationResult(item) && item.extraDrivingCost !== null,
    );

    const totalExtraDistanceKm = calculatedItems.reduce(
      (sum, item) => sum + (item.extraDistanceKm ?? 0),
      0,
    );

    const totalExtraDrivingCost = calculatedItems.reduce(
      (sum, item) => sum + (item.extraDrivingCost ?? 0),
      0,
    );

    const totalEstimatedRevenue = calculatedItems.reduce(
      (sum, item) =>
        sum +
        (item.simulatedProfitability?.estimated_revenue ??
          ("price" in item ? item.price : 0)),
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
  }, [
    currentEquipageSummary,
    selectedConsignments,
    selectedFictitiousBookings,
  ]);

  function persistSimulatorCache(payload: SimulatorCachePayload): void {
    safeSetSessionStorageJson(SIMULATOR_CACHE_KEY, payload);
  }

  function handleDateChange(value: string) {
    setSelectedDate(value);
    setSelectedLineId(null);
    setSelectedEquipageId(null);
    setSelectedConsignmentIds([]);
    setSelectedFictitiousBookingIds([]);
    setUnassignedConsignments([]);
    setCurrentEquipageSummary(null);
  }

  function handleLineChange(lineId: number | null) {
    setSelectedLineId(lineId);
    setSelectedEquipageId(null);
    setSelectedConsignmentIds([]);
    setSelectedFictitiousBookingIds([]);
    setUnassignedConsignments([]);
    setCurrentEquipageSummary(null);
  }

  function handleEquipageChange(equipageId: number | null) {
    setSelectedEquipageId(equipageId);
  }

  function toggleConsignment(consignmentId: number) {
    setSelectedConsignmentIds((current) =>
      current.includes(consignmentId)
        ? current.filter((id) => id !== consignmentId)
        : [...current, consignmentId],
    );
  }

  async function addFictitiousBooking(
    input: NewFictitiousBookingInput,
  ): Promise<AddFictitiousBookingResult> {
    const normalizedTaxPointRelation = normalizeFictitiousTaxPointRelation(
      input.taxPointRelation,
    );
    const rawPrice =
      typeof input.price === "string" ? input.price.trim() : input.price;
    const price =
      typeof rawPrice === "number" ? rawPrice : Number(rawPrice.replace(",", "."));
    const fieldErrors: AddFictitiousBookingFieldErrors = {};

    if (
      !FICTITIOUS_TAX_POINT_RELATION_PATTERN.test(normalizedTaxPointRelation)
    ) {
      fieldErrors.taxPointRelation =
        "Taxerelation måste ha formatet 12345-67890.";
    }

    if (typeof rawPrice === "string" && rawPrice.length === 0) {
      fieldErrors.price = "Pris måste vara ett nummer.";
    } else if (!Number.isFinite(price)) {
      fieldErrors.price = "Pris måste vara ett nummer.";
    } else if (price < 0) {
      fieldErrors.price = "Pris får inte vara negativt.";
    }

    if (fieldErrors.taxPointRelation || fieldErrors.price) {
      return { success: false, fieldErrors };
    }

    const parsed = parseTaxPointRelation(normalizedTaxPointRelation);
    if (!parsed) {
      return {
        success: false,
        fieldErrors: {
          taxPointRelation: "Taxerelation måste ha formatet 12345-67890.",
        },
      };
    }

    setIsAddingFictitiousBooking(true);

    try {
      const distanceKm = await getDistanceKmBetweenTaxPoints(
        parsed.sender,
        parsed.receiver,
      );

      if (distanceKm === null) {
        return {
          success: false,
          fieldErrors: {
            taxPointRelation: `Taxepoint ${normalizedTaxPointRelation} finns inte, kan inte beräkna avstånd.`,
          },
        };
      }

      const id = `fiktiv-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

      setFictitiousBookings((current) => [
        ...current,
        {
          id,
          taxPointRelation: `${parsed.sender}-${parsed.receiver}`,
          price,
        },
      ]);
      setSelectedFictitiousBookingIds((current) => [...current, id]);
      setErrorMsg("");
      return { success: true };
    } catch (error) {
      return {
        success: false,
        fieldErrors: {
          taxPointRelation:
            error instanceof Error
              ? `Kunde inte kontrollera taxerelationen: ${error.message}`
              : "Kunde inte kontrollera taxerelationen.",
        },
      };
    } finally {
      setIsAddingFictitiousBooking(false);
    }
  }

  function removeFictitiousBooking(id: string) {
    setFictitiousBookings((current) =>
      current.filter((booking) => booking.id !== id),
    );
    setSelectedFictitiousBookingIds((current) =>
      current.filter((bookingId) => bookingId !== id),
    );
  }

  function toggleFictitiousBooking(id: string) {
    setSelectedFictitiousBookingIds((current) =>
      current.includes(id)
        ? current.filter((bookingId) => bookingId !== id)
        : [...current, id],
    );
  }

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

  async function runSimulation() {
    if (!selectedEquipageId) {
      setErrorMsg("Välj ett ekipage att simulera på.");
      return;
    }

    if (!currentEquipageSummary) {
      setErrorMsg("Ekipagets nuvarande bokningar har inte laddats.");
      return;
    }

    if (
      selectedConsignmentIds.length === 0 &&
      selectedFictitiousBookingIds.length === 0
    ) {
      setErrorMsg("Välj minst en bokning att simulera.");
      return;
    }

    setErrorMsg("");
    setIsSimulating(true);

    try {
      const selectedIdSet = new Set(selectedConsignmentIds);
      const selectedFictitiousIdSet = new Set(selectedFictitiousBookingIds);
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

        const distanceKm = await getDistanceKmBetweenTaxPoints(
          sender,
          receiver,
        );
        distanceCache.set(forwardKey, distanceKm);
        return distanceKm;
      }

      let currentRouteStops = buildDeliveryRouteWithStartAndStop(
        currentEquipageSummary.consignments,
      );

      const currentRouteDistance = await calculateRouteDistanceKm(
        currentRouteStops,
        getCachedDistanceKm,
      );

      let currentRouteDistanceKm = currentRouteDistance.distanceKm;

      const simulatedById = new Map<number, SimulatedConsignment>();
      const simulatedFictitiousById = new Map<string, FictitiousBooking>();

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
            missingDistanceRelation: null,
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

        const extraDrivingCost =
          routeResult.extraDistanceKm === null
            ? null
            : calculateExtraDrivingCost(
                routeResult.extraDistanceKm,
                mileCostReferenceValue,
              );

        const { simulatedProfitability, revenueMatchStep } =
          await calculateRevenueLikeHome(consignment);

        if (routeResult.optimizedDistanceKm !== null) {
          currentRouteStops = routeResult.optimizedStops;
          currentRouteDistanceKm = routeResult.optimizedDistanceKm;
        }

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
          missingDistanceRelation: routeResult.missingDistanceRelation,
        });
      }

      for (const booking of fictitiousBookings) {
        if (!selectedFictitiousIdSet.has(booking.id)) {
          continue;
        }

        const parsed = parseTaxPointRelation(booking.taxPointRelation);

        if (!parsed) {
          simulatedFictitiousById.set(booking.id, {
            ...booking,
            simulatedProfitability: null,
            revenueMatchStep: null,
            extraDistanceKm: null,
            extraDrivingCost: null,
            originalRouteDistanceKm: null,
            optimizedRouteDistanceKm: null,
            optimizedRouteStops: null,
            insertionPickupIndex: null,
            insertionDeliveryIndex: null,
            missingDistanceRelation: null,
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

        const extraDrivingCost =
          routeResult.extraDistanceKm === null
            ? null
            : calculateExtraDrivingCost(
                routeResult.extraDistanceKm,
                mileCostReferenceValue,
              );

        if (routeResult.optimizedDistanceKm !== null) {
          currentRouteStops = routeResult.optimizedStops;
          currentRouteDistanceKm = routeResult.optimizedDistanceKm;
        }

        simulatedFictitiousById.set(booking.id, {
          ...booking,
          simulatedProfitability: {
            estimated_revenue: booking.price,
            step_used: 0,
          } satisfies ProfitabilityValue,
          revenueMatchStep: null,
          extraDistanceKm: routeResult.extraDistanceKm,
          extraDrivingCost,
          originalRouteDistanceKm: routeResult.originalDistanceKm,
          optimizedRouteDistanceKm: routeResult.optimizedDistanceKm,
          optimizedRouteStops: routeResult.optimizedStops,
          insertionPickupIndex: routeResult.pickupIndex,
          insertionDeliveryIndex: routeResult.deliveryIndex,
          missingDistanceRelation: routeResult.missingDistanceRelation,
        });
      }

      setUnassignedConsignments((current) =>
        current.map(
          (consignment) =>
            simulatedById.get(consignment.consignmentId) ?? consignment,
        ),
      );

      setFictitiousBookings((current) =>
        current.map(
          (booking) => simulatedFictitiousById.get(booking.id) ?? booking,
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

  function clearSimulationSelection() {
    setSelectedConsignmentIds([]);
    setSelectedFictitiousBookingIds([]);
  }

  function resetSimulationResults() {
    setSelectedConsignmentIds([]);
    setSelectedFictitiousBookingIds([]);
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
        missingDistanceRelation: undefined,
      })),
    );
    setFictitiousBookings((current) =>
      current.map((booking) => ({
        ...booking,
        simulatedProfitability: undefined,
        revenueMatchStep: undefined,
        extraDistanceKm: undefined,
        extraDrivingCost: undefined,
        originalRouteDistanceKm: undefined,
        optimizedRouteDistanceKm: undefined,
        optimizedRouteStops: undefined,
        insertionPickupIndex: undefined,
        insertionDeliveryIndex: undefined,
        missingDistanceRelation: undefined,
      })),
    );
  }

  useEffect(() => {
    async function loadCurrentUserSettings() {
      const settings = await getCurrentTransportPlanningUserSettings();
      setSelectedAreas(settings.selectedAreas);
      setProfitabilityReferenceValue(settings.profitabilityReferenceValue);
      setMileCostReferenceValue(settings.mileCostReferenceValue);
      setAreasLoaded(true);
    }

    void loadCurrentUserSettings();
  }, []);

  useEffect(() => {
    const cached =
      safeGetSessionStorageJson<SimulatorCachePayload>(SIMULATOR_CACHE_KEY);

    if (cached) {
      setSelectedDate(cached.selectedDate || getDefaultNextDate());
      setSelectedLineId(cached.selectedLineId ?? null);
      setSelectedEquipageId(cached.selectedEquipageId ?? null);
      setSelectedConsignmentIds(cached.selectedConsignmentIds ?? []);
      setSelectedFictitiousBookingIds(
        cached.selectedFictitiousBookingIds ?? [],
      );
      setUnassignedConsignments(cached.unassignedConsignments ?? []);
      setFictitiousBookings(cached.fictitiousBookings ?? []);
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
      selectedFictitiousBookingIds,
      unassignedConsignments,
      fictitiousBookings,
    });
  }, [
    fictitiousBookings,
    hasHydrated,
    selectedDate,
    selectedEquipageId,
    selectedFictitiousBookingIds,
    selectedLineId,
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

    void loadLinesAndAreaEquipages();
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
            try {
              const response = await getIlogConsignments(ilogDate, equipage.id);
              const consignments = (response.data ??
                []) as ConsignmentListItem[];

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
            } catch (error) {
              console.warn("Failed checking equipage:", equipage.id, error);
            }
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
          setSelectedFictitiousBookingIds([]);
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

    void loadHomeVisibleLines();
  }, [
    availableLines,
    filteredAreaEquipages,
    selectedAreaLabels,
    selectedDate,
    selectedLineId,
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
            try {
              const response = await getIlogConsignments(ilogDate, equipage.id);
              const consignments = (response.data ??
                []) as ConsignmentListItem[];

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
            } catch {
              return null;
            }
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

    void loadEquipagesForSelectedLineUsingHomeLogic();
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
                missingDistanceRelation: previous.missingDistanceRelation,
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

    void loadUnassignedConsignments();
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

    void loadCurrentEquipage();
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
    fictitiousBookings,
    selectedFictitiousBookingIds,
    selectedFictitiousBookings,
    addFictitiousBooking,
    removeFictitiousBooking,
    toggleFictitiousBooking,
    toggleConsignment,
    clearSimulationSelection,
    resetSimulationResults,
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
    isAddingFictitiousBooking,
    errorMsg,
    milprisPerMil: mileCostReferenceValue,
  };
}
