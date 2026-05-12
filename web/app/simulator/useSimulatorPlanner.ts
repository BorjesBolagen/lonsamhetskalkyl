"use client";

import { useEffect, useMemo, useState } from "react";
import { getIlogConsignments, getIlogEquipages } from "../../lib/api";
import type { ProfitabilityValue } from "../../lib/api";
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
  filterEquipagesForSelectedLine,
  getFilteredLinesAndEquipagesForAreas,
  getSelectedAreaLabels,
  parseTaxPointRelation,
  safeGetSessionStorageJson,
  safeSetSessionStorageJson,
  toIlogDate,
} from "../../lib/backend/transportPlanningUtils";

// Cache-nyckel för att kunna återställa simulatorns senaste lokala urval.
const SIMULATOR_CACHE_KEY = "simulator-cache-v9";
const FICTITIOUS_TAX_POINT_RELATION_PATTERN = /^\d{5}-\d{5}$/;

type SimulatorLine = LineItem & {
  cluster: string;
};

// Fiktiva bokningar har användarstyrd intäkt och behöver därför inte prissteg.
type SimulatedRevenueValue = {
  estimated_revenue: number;
  step_used?: number | null;
  detail?: string;
};

// Utökar iLog-bokningar med fält som bara används efter simulering.
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

// Lokal modell för en manuell bokning som inte finns i iLog.
export type FictitiousBooking = {
  id: string;
  taxPointRelation: string;
  price: number;
  simulatedProfitability?: SimulatedRevenueValue | null;
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
  consignments: SimulatedConsignment[];
  totalFlm: number;
  totalWeightKg: number;
};

type ActiveCurrentEquipageSummary = CurrentEquipageSummary & {
  excludedConsignmentIds: number[];
  excludedConsignments: SimulatedConsignment[];
  excludedFlm: number;
  excludedWeightKg: number;
};

type SimulatorCachePayload = {
  selectedDate: string;
  selectedLineId: number | null;
  selectedEquipageId: number | null;
  selectedConsignmentIds: number[];
  selectedFictitiousBookingIds: string[];
  excludedCurrentConsignmentIds: number[];
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

// Hämtar oplacerade bokningar för vald linje och dag via intern API-route.
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

// Slår upp avstånd i en bestämd riktning mellan två taxepunkter.
async function getDistanceKmForDirectedTaxPointRelation(
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

// Testar även omvänd relation eftersom avståndstabellen inte alltid är riktad åt samma håll.
async function getDistanceKmBetweenTaxPoints(
  sender: string,
  receiver: string,
): Promise<number | null> {
  const forwardDistanceKm = await getDistanceKmForDirectedTaxPointRelation(
    sender,
    receiver,
  );

  if (forwardDistanceKm !== null) {
    return forwardDistanceKm;
  }

  return getDistanceKmForDirectedTaxPointRelation(receiver, sender);
}

function normalizeFictitiousTaxPointRelation(value: string): string {
  return value.trim().replace(/\s+/g, "");
}


// Tar bort gamla simuleringsvärden så nya körningar bara speglar aktuellt urval.
function clearConsignmentSimulationFields<T extends SimulatedConsignment>(
  consignment: T,
): T {
  return {
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
  };
}

// Rensar beräknade fält för fiktiva bokningar utan att ta bort användarens inmatning.
function clearFictitiousSimulationFields(
  booking: FictitiousBooking,
): FictitiousBooking {
  return {
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
  };
}

// Används för att skilja beräknade rader från rader som ännu inte simulerats.
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
  const [excludedCurrentConsignmentIds, setExcludedCurrentConsignmentIds] =
    useState<number[]>([]);

  const [isLoadingLines, setIsLoadingLines] = useState(false);
  const [isLoadingEquipages, setIsLoadingEquipages] = useState(false);
  const [isLoadingUnassigned, setIsLoadingUnassigned] = useState(false);
  const [isLoadingCurrentEquipage, setIsLoadingCurrentEquipage] =
    useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Härledda val gör renderingen enklare och undviker upprepade filter i JSX.
  const selectedAreaLabels = useMemo(
    () => getSelectedAreaLabels(selectedAreas),
    [selectedAreas],
  );

  const selectedLine = useMemo(
    () => availableLines.find((line) => line.id === selectedLineId) ?? null,
    [availableLines, selectedLineId],
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

  // Aktivt ekipage är nuvarande bokningar minus dem användaren valt att ta bort i simuleringen.
  const activeCurrentEquipageSummary =
    useMemo<ActiveCurrentEquipageSummary | null>(() => {
      if (!currentEquipageSummary) {
        return null;
      }

      const excludedIdSet = new Set(excludedCurrentConsignmentIds);

      // Bokningar som är urbockade räknas bort ur den simulerade startrutten.
      const activeConsignments = currentEquipageSummary.consignments.filter(
        (consignment) => !excludedIdSet.has(consignment.consignmentId),
      );
      const excludedConsignments = currentEquipageSummary.consignments.filter(
        (consignment) => excludedIdSet.has(consignment.consignmentId),
      );
      const activeTotals = calculateConsignmentTotals(activeConsignments);
      const excludedTotals = calculateConsignmentTotals(excludedConsignments);

      return {
        consignments: activeConsignments,
        totalFlm: activeTotals.totalFlm,
        totalWeightKg: activeTotals.totalWeightKg,
        excludedConsignmentIds: excludedCurrentConsignmentIds,
        excludedConsignments,
        excludedFlm: excludedTotals.totalFlm,
        excludedWeightKg: excludedTotals.totalWeightKg,
      };
    }, [currentEquipageSummary, excludedCurrentConsignmentIds]);

  const selectedFictitiousBookings = useMemo(
    () =>
      fictitiousBookings.filter((booking) =>
        selectedFictitiousBookingIds.includes(booking.id),
      ),
    [fictitiousBookings, selectedFictitiousBookingIds],
  );

  // Summeringen byggs alltid från aktuella markerade rader och deras senaste simuleringsfält.
  const simulationSummary = useMemo(() => {
    const selectedCurrentConsignments =
      activeCurrentEquipageSummary?.consignments ?? [];
    const removedCurrentConsignments =
      activeCurrentEquipageSummary?.excludedConsignments ?? [];

    const addedWeightKg = [
      ...selectedCurrentConsignments,
      ...selectedConsignments,
    ].reduce((sum, consignment) => sum + (consignment.weight ?? 0), 0);

    const addedFlm = [
      ...selectedCurrentConsignments,
      ...selectedConsignments,
    ].reduce((sum, consignment) => sum + (consignment.flm ?? 0), 0);

    const selectedItems = [
      ...selectedCurrentConsignments,
      ...selectedConsignments,
      ...selectedFictitiousBookings,
    ];

    const calculatedSelectedItems = selectedItems.filter(
      (item) => hasSimulationResult(item) && item.extraDrivingCost !== null,
    );

    const calculatedRemovedItems = removedCurrentConsignments.filter(
      (item) => hasSimulationResult(item) && item.extraDrivingCost !== null,
    );

    const addedExtraDistanceKm = calculatedSelectedItems.reduce(
      (sum, item) => sum + (item.extraDistanceKm ?? 0),
      0,
    );

    const removedExtraDistanceKm = calculatedRemovedItems.reduce(
      (sum, item) => sum + (item.extraDistanceKm ?? 0),
      0,
    );

    const addedExtraDrivingCost = calculatedSelectedItems.reduce(
      (sum, item) => sum + (item.extraDrivingCost ?? 0),
      0,
    );

    const removedExtraDrivingCost = calculatedRemovedItems.reduce(
      (sum, item) => sum + (item.extraDrivingCost ?? 0),
      0,
    );

    const addedEstimatedRevenue = calculatedSelectedItems.reduce(
      (sum, item) =>
        sum +
        (item.simulatedProfitability?.estimated_revenue ??
          ("price" in item ? item.price : 0)),
      0,
    );

    const removedEstimatedRevenue = calculatedRemovedItems.reduce(
      (sum, item) =>
        sum + (item.simulatedProfitability?.estimated_revenue ?? 0),
      0,
    );

    const totalExtraDistanceKm = addedExtraDistanceKm - removedExtraDistanceKm;
    const totalExtraDrivingCost =
      addedExtraDrivingCost - removedExtraDrivingCost;
    const totalEstimatedRevenue =
      addedEstimatedRevenue - removedEstimatedRevenue;
    const simulatedMargin = totalEstimatedRevenue - totalExtraDrivingCost;
    const currentFlm = activeCurrentEquipageSummary?.totalFlm ?? 0;
    const simulatedFlm =
      currentFlm +
      selectedConsignments.reduce(
        (sum, consignment) => sum + (consignment.flm ?? 0),
        0,
      );

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
    activeCurrentEquipageSummary,
    selectedConsignments,
    selectedFictitiousBookings,
  ]);

  // Sparar bara lokalt UI-läge, inte några permanenta ändringar i iLog.
  function persistSimulatorCache(payload: SimulatorCachePayload): void {
    safeSetSessionStorageJson(SIMULATOR_CACHE_KEY, payload);
  }

  /**
   * Byter datum och nollställer beroende val.
   */
  function handleDateChange(value: string) {
    // Datumbyte ska behålla vald linje och valt ekipage så att användaren kan jämföra dagar.
    setSelectedDate(value);
    setSelectedConsignmentIds([]);
    setExcludedCurrentConsignmentIds([]);
    setUnassignedConsignments([]);
    setCurrentEquipageSummary(null);
  }

  /**
   * Byter linje och nollställer beroende val.
   */
  function handleLineChange(lineId: number | null) {
    // Ekipage får inte hämtas/visas förrän användaren har valt linje.
    setSelectedLineId(lineId);
    setSelectedEquipageId(null);
    setSelectedConsignmentIds([]);
    setExcludedCurrentConsignmentIds([]);
    setUnassignedConsignments([]);
    setCurrentEquipageSummary(null);
    setAvailableEquipages([]);
  }

  // Vid byte av ekipage börjar borttagningsurvalet om för att undvika fel korskoppling.
  function handleEquipageChange(equipageId: number | null) {
    setSelectedEquipageId(equipageId);
    setExcludedCurrentConsignmentIds([]);
  }

  function toggleCurrentConsignment(consignmentId: number) {
    // Checkboxen styr om en befintlig bokning ska ingå i startrutten eller tas bort lokalt.
    setExcludedCurrentConsignmentIds((current) =>
      current.includes(consignmentId)
        ? current.filter((id) => id !== consignmentId)
        : [...current, consignmentId],
    );
  }

  // Markerar oplacerade bokningar som ska testas som nya stopp i rutten.
  function toggleConsignment(consignmentId: number) {
    setSelectedConsignmentIds((current) =>
      current.includes(consignmentId)
        ? current.filter((id) => id !== consignmentId)
        : [...current, consignmentId],
    );
  }

  // Validerar manuell taxerelation och pris innan bokningen läggs till i listan.
  async function addFictitiousBooking(
    input: NewFictitiousBookingInput,
  ): Promise<AddFictitiousBookingResult> {
    const normalizedTaxPointRelation = normalizeFictitiousTaxPointRelation(
      input.taxPointRelation,
    );
    const rawPrice =
      typeof input.price === "string" ? input.price.trim() : input.price;
    const price =
      typeof rawPrice === "number"
        ? rawPrice
        : Number(rawPrice.replace(",", "."));
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

  // Återanvänder samma intäktslogik som startsidans lönsamhetsberäkning.
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

  // Kör en ny simulering från aktuellt urval och skriver över tidigare beräknade fält.
  async function runSimulation() {
    if (!selectedEquipageId) {
      setErrorMsg("Välj ett ekipage att simulera på.");
      return;
    }

    if (!activeCurrentEquipageSummary) {
      setErrorMsg("Ekipagets nuvarande bokningar har inte laddats.");
      return;
    }

    const selectedCurrentConsignments =
      activeCurrentEquipageSummary.consignments;

    if (
      selectedCurrentConsignments.length === 0 &&
      selectedConsignmentIds.length === 0 &&
      selectedFictitiousBookingIds.length === 0 &&
      excludedCurrentConsignmentIds.length === 0
    ) {
      setErrorMsg("Välj minst en bokning att simulera.");
      return;
    }

    setErrorMsg("");
    setIsSimulating(true);

    try {
      const selectedIdSet = new Set(selectedConsignmentIds);
      const distanceCache = new Map<string, number | null>();

      // Cache minskar antalet uppslag för samma taxepunktsrelation under en körning.
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
        distanceCache.set(reverseKey, distanceKm);
        return distanceKm;
      }

      // Ikryssade befintliga bokningar simuleras som egna steg, på samma sätt som oplacerade och fiktiva bokningar.
      let currentRouteStops = buildDeliveryRouteWithStartAndStop([]);

      let currentRouteDistanceKm = await calculateRouteDistanceKm(
        currentRouteStops,
        getCachedDistanceKm,
      );

      const simulatedById = new Map<number, SimulatedConsignment>();
      const simulatedCurrentById = new Map<number, SimulatedConsignment>();
      const simulatedFictitiousById = new Map<string, FictitiousBooking>();

      // Simulerar en iLog-bokning som pickup + leverans och beräknar marginaldata.
      async function simulateConsignmentInsertion(
        consignment: ConsignmentListItem,
      ): Promise<SimulatedConsignment> {
        const parsed = parseTaxPointRelation(consignment.taxPointRelation);

        if (!parsed) {
          return {
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
          };
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

        return {
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
        };
      }

      // Befintliga markerade bokningar behandlas som simulerade rader, men inte som nya tillägg i UI:t.
      for (const consignment of selectedCurrentConsignments) {
        simulatedCurrentById.set(
          consignment.consignmentId,
          await simulateConsignmentInsertion(consignment),
        );
      }

      // Endast markerade oplacerade bokningar ska ingå i den här körningens resultat.
      for (const consignment of unassignedConsignments) {
        if (!selectedIdSet.has(consignment.consignmentId)) {
          continue;
        }

        simulatedById.set(
          consignment.consignmentId,
          await simulateConsignmentInsertion(consignment),
        );
      }

      // Fiktiva bokningar använder användarens pris som intäkt och hoppar över prissteg.
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
          },
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

      // Alla rader som inte simulerades i denna körning rensas från gamla resultat.
      setCurrentEquipageSummary((current) =>
        current
          ? {
              ...current,
              consignments: current.consignments.map((consignment) => {
                const simulated = simulatedCurrentById.get(
                  consignment.consignmentId,
                );

                return simulated ?? clearConsignmentSimulationFields(consignment);
              }),
            }
          : current,
      );

      setUnassignedConsignments((current) =>
        current.map((consignment) => {
          const simulated = simulatedById.get(consignment.consignmentId);

          return simulated ?? clearConsignmentSimulationFields(consignment);
        }),
      );

      setFictitiousBookings((current) =>
        current.map((booking) => {
          const simulated = simulatedFictitiousById.get(booking.id);

          return simulated ?? clearFictitiousSimulationFields(booking);
        }),
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

  // Tömmer endast valen, men lämnar eventuellt visade beräkningsresultat kvar.
  function clearSimulationSelection() {
    setSelectedConsignmentIds([]);
    setSelectedFictitiousBookingIds([]);
    setExcludedCurrentConsignmentIds([]);
  }

  // Återställer både val och beräkningsfält till ett osimulerat läge.
  function resetSimulationResults() {
    setSelectedConsignmentIds([]);
    setSelectedFictitiousBookingIds([]);
    setExcludedCurrentConsignmentIds([]);
    setCurrentEquipageSummary((current) =>
      current
        ? {
            ...current,
            consignments: current.consignments.map((consignment) =>
              clearConsignmentSimulationFields(consignment),
            ),
          }
        : current,
    );
    setUnassignedConsignments((current) =>
      current.map((consignment) => clearConsignmentSimulationFields(consignment)),
    );
    setFictitiousBookings((current) =>
      current.map((booking) => clearFictitiousSimulationFields(booking)),
    );
  }

  useEffect(() => {
    // Läser användarens sparade områden och referensvärden vid sidladdning.
    async function loadCurrentUserSettings() {
      const settings = await getCurrentTransportPlanningUserSettings();
      setSelectedAreas(settings.selectedAreas);
      setProfitabilityReferenceValue(settings.profitabilityReferenceValue);
      setAreasLoaded(true);
    }

    loadCurrentUserSettings();
  }, []);

  useEffect(() => {
    // Återställer senaste simulatorurvalet från sessionStorage.
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
      setExcludedCurrentConsignmentIds(
        cached.excludedCurrentConsignmentIds ?? [],
      );
      setUnassignedConsignments(cached.unassignedConsignments ?? []);
    }

    setHasHydrated(true);
  }, []);

  useEffect(() => {
    // Skriv cache först när initial återläsning är klar.
    if (!hasHydrated) {
      return;
    }

    persistSimulatorCache({
      selectedDate,
      selectedLineId,
      selectedEquipageId,
      selectedConsignmentIds,
      selectedFictitiousBookingIds,
      excludedCurrentConsignmentIds,
      unassignedConsignments,
    });
  }, [
    hasHydrated,
    selectedDate,
    selectedEquipageId,
    selectedFictitiousBookingIds,
    excludedCurrentConsignmentIds,
    selectedLineId,
    selectedEquipageId,
    selectedConsignmentIds,
    unassignedConsignments,
  ]);

  useEffect(() => {
    // Hämtar linjer efter att användarens område/kluster har laddats.
    async function loadLinesForSelectedAreas() {
      if (!areasLoaded) {
        return;
      }

      setIsLoadingLines(true);
      setErrorMsg("");

      try {
        const { approvedLines } =
          await getFilteredLinesAndEquipagesForAreas(selectedAreaLabels);

        setAvailableLines(approvedLines as SimulatorLine[]);
        setFilteredAreaEquipages([]);
      } catch {
        setErrorMsg("Kunde inte hämta linjer.");
        setAvailableLines([]);
        setHomeVisibleLines([]);
        setFilteredAreaEquipages([]);
      } finally {
        setIsLoadingLines(false);
      }
    }

    void loadLinesForSelectedAreas();
  }, [areasLoaded, selectedAreaLabels]);

  useEffect(() => {
    // Feedback: linjelistan ska visa alla linjer i valda kluster, även riktningar utan lastade bokningar.
    setHomeVisibleLines(availableLines);
  }, [availableLines]);

  useEffect(() => {
    // Hämtar ekipage först när både linje och giltigt datum finns.
    async function loadEquipagesForSelectedLine() {
      if (!selectedLine || !selectedDate) {
        setAvailableEquipages([]);
        setSelectedEquipageId(null);
        setCurrentEquipageSummary(null);
        setExcludedCurrentConsignmentIds([]);
        return;
      }

      const ilogDate = toIlogDate(selectedDate);
      if (!ilogDate) {
        setAvailableEquipages([]);
        setSelectedEquipageId(null);
        setCurrentEquipageSummary(null);
        setExcludedCurrentConsignmentIds([]);
        return;
      }

      setIsLoadingEquipages(true);
      setErrorMsg("");

      try {
        const response = await getIlogEquipages();

        if (!response.status) {
          setErrorMsg(
            response.message || "Kunde inte hämta ekipage för vald linje.",
          );
          setAvailableEquipages([]);
          setSelectedEquipageId(null);
          setCurrentEquipageSummary(null);
          setExcludedCurrentConsignmentIds([]);
          return;
        }

        const equipages = filterEquipagesForSelectedLine(
          (response.data ?? []) as EquipageItem[],
          selectedLine,
        ).sort((a, b) => a.name.localeCompare(b.name, "sv"));

        setAvailableEquipages(equipages);

        setSelectedEquipageId((current) =>
          current && equipages.some((equipage) => equipage.id === current)
            ? current
            : null,
        );
      } catch {
        setErrorMsg("Kunde inte hämta ekipage för vald linje.");
        setAvailableEquipages([]);
        setSelectedEquipageId(null);
        setCurrentEquipageSummary(null);
        setExcludedCurrentConsignmentIds([]);
      } finally {
        setIsLoadingEquipages(false);
      }
    }

    void loadEquipagesForSelectedLine();
  }, [selectedLine, selectedDate]);

  useEffect(() => {
    // Nollställ valt ekipage om det inte längre finns i den filtrerade listan.
    if (
      selectedEquipageId &&
      !availableEquipages.some((equipage) => equipage.id === selectedEquipageId)
    ) {
      setSelectedEquipageId(null);
      setCurrentEquipageSummary(null);
      setExcludedCurrentConsignmentIds([]);
    }
  }, [availableEquipages, selectedEquipageId]);

  useEffect(() => {
    // Hämtar oplacerade bokningar och behåller gamla simuleringsfält där samma id återkommer.
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
    // Hämtar bokningar som redan ligger på valt ekipage för valt datum.
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
        const consignments = (response.data ?? []) as SimulatedConsignment[];
        const totals = calculateConsignmentTotals(consignments);

        // Ta bort gamla urval som inte finns på det nya datumets ekipagelista.
        setExcludedCurrentConsignmentIds((current) =>
          current.filter((id) =>
            consignments.some(
              (consignment) => consignment.consignmentId === id,
            ),
          ),
        );

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
    activeCurrentEquipageSummary,
    excludedCurrentConsignmentIds,
    toggleCurrentConsignment,
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
