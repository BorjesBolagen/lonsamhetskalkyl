"use client";

import { useState, type ReactNode } from "react";
import Navigation from "../../components/Navigation";
import Footer from "../../components/Footer";
import type { ConsignmentListItem } from "../../lib/ilogTypes";
import { useSimulatorPlanner } from "./useSimulatorPlanner";

type RevenueFields = {
  simulatedProfitability?: {
    estimated_revenue?: number | null;
    step_used?: number | null;
  } | null;
  revenueMatchStep?: number | null;
  extraDistanceKm?: number | null;
  extraDrivingCost?: number | null;
  optimizedRouteStops?: string[] | null;
  insertionPickupIndex?: number | null;
  insertionDeliveryIndex?: number | null;
  missingDistanceRelation?: string | null;
};

type RouteMarkerFields = RevenueFields & {
  taxPointRelation?: string | null;
  pickupLocationCity?: string | null;
  destinationCity?: string | null;
};

type BookingLike = RevenueFields & {
  consignmentId?: number;
  customerName?: string | null;
  customer?: { name?: string | null } | null;
  pickupLocationCity?: string | null;
  destinationCity?: string | null;
  taxPointRelation?: string | null;
  weight?: number | null;
  flm?: number | null;
  sourceEquipageName?: string | null;
};

export default function SimulatorPage() {
  const {
    selectedDate,
    setSelectedDate,
    availableLines,
    selectedLineId,
    setSelectedLineId,
    selectedLine,
    availableEquipages,
    selectedEquipageId,
    setSelectedEquipageId,
    selectedEquipage,
    unassignedConsignments,
    selectedConsignmentIds,
    selectedConsignments,
    fictitiousBookings,
    selectedFictitiousBookingIds,
    selectedFictitiousBookings,
    otherEquipageConsignments,
    selectedOtherEquipageConsignmentKeys,
    selectedOtherEquipageConsignments,
    getOtherEquipageConsignmentKey,
    toggleOtherEquipageConsignment,
    addFictitiousBooking,
    removeFictitiousBooking,
    toggleFictitiousBooking,
    toggleConsignment,
    clearCurrentEquipageSelection,
    clearUnassignedSelection,
    clearOtherEquipageSelection,
    clearFictitiousSelection,
    resetSimulationResults,
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
    isLoadingOtherEquipageConsignments,
    isSimulating,
    isAddingFictitiousBooking,
    errorMsg,
    milprisPerMil,
  } = useSimulatorPlanner();

  const [showCalculatedParts, setShowCalculatedParts] = useState(false);
  const [isCurrentEquipageBookingsOpen, setIsCurrentEquipageBookingsOpen] =
    useState(false);
  const [isUnassignedBookingsOpen, setIsUnassignedBookingsOpen] =
    useState(false);
  const [isOtherEquipageBookingsOpen, setIsOtherEquipageBookingsOpen] =
    useState(false);
  const [isFictitiousBookingsOpen, setIsFictitiousBookingsOpen] =
    useState(false);
  const [isFictitiousModalOpen, setIsFictitiousModalOpen] = useState(false);
  const [fictitiousTaxPointRelation, setFictitiousTaxPointRelation] =
    useState("");
  const [fictitiousPrice, setFictitiousPrice] = useState("");
  const [fictitiousFieldErrors, setFictitiousFieldErrors] = useState<{
    taxPointRelation?: string;
    price?: string;
  }>({});

  const selectedCurrentConsignments =
    activeCurrentEquipageSummary?.consignments ?? [];

  const selectedBookingCount =
    selectedConsignmentIds.length +
    selectedOtherEquipageConsignmentKeys.length +
    selectedFictitiousBookingIds.length;
  const excludedCurrentBookingCount = excludedCurrentConsignmentIds.length;
  const totalChangeCount = selectedBookingCount + excludedCurrentBookingCount;

  const simulatedSelectedCurrentConsignments = showCalculatedParts
    ? selectedCurrentConsignments.filter((consignment) =>
        hasRowSimulationResult(consignment as RevenueFields),
      )
    : [];

  const simulatedSelectedConsignments = showCalculatedParts
    ? selectedConsignments.filter((consignment) =>
        hasRowSimulationResult(consignment as RevenueFields),
      )
    : [];

  const simulatedSelectedOtherEquipageConsignments = showCalculatedParts
    ? selectedOtherEquipageConsignments.filter((consignment) =>
        hasRowSimulationResult(consignment as RevenueFields),
      )
    : [];

  const simulatedSelectedFictitiousBookings = showCalculatedParts
    ? selectedFictitiousBookings.filter((booking) =>
        hasRowSimulationResult(booking as RevenueFields),
      )
    : [];

  const simulatedAddedItems: RouteMarkerFields[] = [
    ...simulatedSelectedConsignments,
    ...simulatedSelectedOtherEquipageConsignments,
    ...simulatedSelectedFictitiousBookings,
  ];

  const simulatedSelectedItems: RouteMarkerFields[] = [
    ...simulatedSelectedCurrentConsignments,
    ...simulatedAddedItems,
  ];

  const primaryRoute = [...simulatedSelectedItems].reverse().find((item) => {
    const data = item as RevenueFields;
    return (data.optimizedRouteStops?.length ?? 0) > 0;
  }) as (RouteMarkerFields & RevenueFields) | undefined;

  const displayedSimulationSummary = showCalculatedParts
    ? simulationSummary
    : {
        totalExtraDrivingCost: 0,
        totalEstimatedRevenue: 0,
        totalExtraDistanceKm: 0,
        simulatedMargin: 0,
      };

  const revenueCoveragePercent =
    displayedSimulationSummary.totalExtraDrivingCost > 0
      ? Math.min(
          100,
          (displayedSimulationSummary.totalEstimatedRevenue /
            displayedSimulationSummary.totalExtraDrivingCost) *
            100,
        )
      : displayedSimulationSummary.totalEstimatedRevenue > 0
        ? 100
        : 0;

  const hasSimulationResult = simulatedSelectedItems.some(
    (item) => (item as RevenueFields).extraDrivingCost != null,
  );

  const selectedPickupMarkers = new Map<string, number>();
  const selectedDeliveryMarkers = new Map<string, number>();

  simulatedAddedItems.forEach((item) => {
    const [pickupTaxPoint, deliveryTaxPoint] =
      item.taxPointRelation?.split("-").map((part) => part.trim()) ?? [];

    addMarkerCandidate(selectedPickupMarkers, pickupTaxPoint);
    addMarkerCandidate(selectedPickupMarkers, item.pickupLocationCity);
    addMarkerCandidate(selectedDeliveryMarkers, deliveryTaxPoint);
    addMarkerCandidate(selectedDeliveryMarkers, item.destinationCity);
  });

  const proposedRouteEntries = (primaryRoute?.optimizedRouteStops ?? []).map(
    (location, index) => {
      const pickupCount = takeMarkerCandidateCount(
        selectedPickupMarkers,
        location,
      );
      const deliveryCount =
        pickupCount === 0
          ? takeMarkerCandidateCount(selectedDeliveryMarkers, location)
          : 0;
      const type =
        pickupCount > 0 ? "pickup" : deliveryCount > 0 ? "delivery" : "stop";
      const bookingCount = Math.max(pickupCount, deliveryCount, 1);

      return {
        key: `${index}-${location}-${type}-${bookingCount}`,
        index,
        type,
        location,
        bookingCount,
        isSimulatedBookingStop: type !== "stop",
      };
    },
  );

  function formatNumber(value: number): string {
    return value.toLocaleString("sv-SE", { maximumFractionDigits: 0 });
  }

  function formatDecimal(value: number): string {
    return value.toLocaleString("sv-SE", { maximumFractionDigits: 1 });
  }

  function getRevenue(item: RevenueFields): number {
    return item.simulatedProfitability?.estimated_revenue ?? 0;
  }

  function getSelectedConsignmentRowColor(
    revenue: number,
    cost?: number | null,
  ): string {
    // Färgsätt markerade rader först när simuleringen har räknat fram kostnad/intäkt.
    if (cost == null) {
      return "bg-[color-mix(in_srgb,var(--button-reset)_14%,var(--primary-element))] text-[var(--text-primary)]";
    }
    if (revenue > cost) {
      return "bg-[color-mix(in_srgb,var(--button-submit)_16%,var(--primary-element))] text-[var(--text-primary)]";
    }
    if (cost > revenue) {
      return "bg-[color-mix(in_srgb,var(--error)_16%,var(--primary-element))] text-[var(--text-primary)]";
    }
    return "bg-[color-mix(in_srgb,var(--button-reset)_14%,var(--primary-element))] text-[var(--text-primary)]";
  }

  function getRevenueStepText(item: RevenueFields): string {
    if (
      item.simulatedProfitability?.estimated_revenue == null ||
      item.simulatedProfitability.estimated_revenue <= 0 ||
      item.revenueMatchStep == null
    ) {
      return "Inget steg gav träff";
    }

    return `Steg ${item.revenueMatchStep}`;
  }

  function getCoverageLabel(): string {
    if (!hasSimulationResult) return "Kör simuleringen för att få prognos.";

    if (displayedSimulationSummary.totalEstimatedRevenue <= 0) {
      return "Inget steg gav träff";
    }

    if (displayedSimulationSummary.simulatedMargin >= 0) {
      return `Prognos: lönsam med ${formatNumber(
        displayedSimulationSummary.simulatedMargin,
      )} kr i marginal.`;
    }

    return `Prognos: inte lönsam. Saknar ${formatNumber(
      Math.abs(displayedSimulationSummary.simulatedMargin),
    )} kr.`;
  }

  function getCoverageTone(): string {
    if (!hasSimulationResult)
      return "border-[var(--seperating-gray)] bg-[var(--primary-element)]";

    return displayedSimulationSummary.simulatedMargin >= 0
      ? "border-[var(--button-submit)] bg-[var(--notification-color)]"
      : "border-[var(--error)] bg-[var(--secondary-element)]";
  }

  function hasRowSimulationResult(data: RevenueFields): boolean {
    return (
      data.extraDistanceKm !== undefined ||
      data.extraDrivingCost !== undefined ||
      data.simulatedProfitability !== undefined ||
      data.missingDistanceRelation !== undefined
    );
  }

  function normalizeRouteValue(value?: string | null): string {
    return (value ?? "").toString().trim().toLowerCase().replace(/\s+/g, " ");
  }

  function addMarkerCandidate(
    markerMap: Map<string, number>,
    value?: string | null,
  ): void {
    const normalizedValue = normalizeRouteValue(value);
    if (!normalizedValue) return;
    markerMap.set(normalizedValue, (markerMap.get(normalizedValue) ?? 0) + 1);
  }

  function takeMarkerCandidateCount(
    markerMap: Map<string, number>,
    location: string,
  ): number {
    const normalizedLocation = normalizeRouteValue(location);

    for (const [candidate, count] of markerMap.entries()) {
      if (count <= 0) continue;

      const isMatch =
        normalizedLocation === candidate ||
        normalizedLocation.includes(candidate) ||
        candidate.includes(normalizedLocation);

      if (!isMatch) continue;

      // Flera valda bokningar kan ha samma hämtnings- eller leveransplats.
      // Då visas platsen en gång i rutten med t.ex. ×2 i stället för dubbla rader.
      markerMap.delete(candidate);
      return count;
    }

    return 0;
  }

  async function handleRunSimulation() {
    setShowCalculatedParts(true);
    await runSimulation();
  }

  function resetCalculatedParts() {
    setShowCalculatedParts(false);
  }

  function sectionActionButtonClass(isPrimary = false): string {
    return isPrimary
      ? "rounded-2xl border border-[var(--button-submit)] bg-[var(--button-submit)] px-3 py-2 text-sm font-semibold text-[var(--navbar)] shadow-sm transition hover:bg-[var(--button-submit-hover)] disabled:cursor-not-allowed disabled:border-[var(--seperating-gray)] disabled:bg-[var(--disabled-button)] disabled:text-[var(--text-hover)]"
      : "rounded-2xl border border-[var(--seperating-gray)] bg-[var(--secondary-element)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] shadow-sm transition hover:border-[var(--seperating-gray)] hover:bg-[var(--primary-element)] disabled:cursor-not-allowed disabled:opacity-40";
  }

  async function handleAddFictitiousBooking() {
    setFictitiousFieldErrors({});

    const result = await addFictitiousBooking({
      taxPointRelation: fictitiousTaxPointRelation,
      price: fictitiousPrice,
    });

    if (!result.success) {
      setFictitiousFieldErrors(result.fieldErrors);
      return;
    }

    setFictitiousTaxPointRelation("");
    setFictitiousPrice("");
    setFictitiousFieldErrors({});
    setIsFictitiousModalOpen(false);
  }

  function renderBookingRow({
    keyValue,
    consignment,
    isSelected,
    onToggle,
    sourceLabel,
    neutralWhenUnselected = false,
  }: {
    keyValue: string | number;
    consignment: BookingLike;
    isSelected: boolean;
    onToggle: () => void;
    sourceLabel?: string | null;
    neutralWhenUnselected?: boolean;
  }) {
    const data = consignment as RevenueFields;
    const shouldShowCalculatedParts =
      showCalculatedParts && hasRowSimulationResult(data);
    const revenue = shouldShowCalculatedParts ? getRevenue(data) : 0;
    const extraDrivingCost = shouldShowCalculatedParts
      ? data.extraDrivingCost
      : null;
    const extraDistanceKm = shouldShowCalculatedParts
      ? data.extraDistanceKm
      : null;
    const rowColor = isSelected
      ? getSelectedConsignmentRowColor(revenue, extraDrivingCost)
      : neutralWhenUnselected
        ? "bg-[var(--primary-element)]"
        : "bg-[var(--primary-element)]";

    return (
      <tr
        key={keyValue}
        className={`border-b border-[var(--seperating-gray)] transition hover:bg-[var(--secondary-element)] ${rowColor}`}
      >
        <td className="px-2 py-2 align-top">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggle}
            className="h-3.5 w-3.5 accent-[var(--button-submit)]"
          />
        </td>
        <td className="px-2 py-2 align-top">
          <div className="whitespace-normal break-words font-semibold leading-snug text-[var(--text-primary)]">
            {getDisplayCustomerName(consignment as ConsignmentListItem) || "-"}
          </div>
          {sourceLabel && (
            <div className="mt-1 inline-flex rounded-full border border-[var(--seperating-gray)] bg-[var(--secondary-element)] px-2 py-0.5 text-xs font-semibold text-[var(--text-secondary)]">
              {sourceLabel}
            </div>
          )}
        </td>
        <td className="px-2 py-2 align-top text-[var(--text-primary)] whitespace-normal break-words leading-snug">
          {consignment.pickupLocationCity || "-"}
        </td>
        <td className="px-2 py-2 align-top text-[var(--text-primary)] whitespace-normal break-words leading-snug">
          {consignment.destinationCity || "-"}
        </td>
        <td className="px-2 py-2 align-top">
          <span className="inline-block rounded-full border border-[var(--seperating-gray)] bg-[var(--secondary-element)] px-1.5 py-0.5 text-[11px] font-semibold leading-snug text-[var(--text-primary)] whitespace-normal break-words">
            {consignment.taxPointRelation?.trim() || "Saknas"}
          </span>
          {shouldShowCalculatedParts && data.missingDistanceRelation && (
            <p className="mt-1 text-xs font-semibold text-[var(--error)]">
              Taxepoint {data.missingDistanceRelation} saknar avstånd.
            </p>
          )}
        </td>
        <td className="px-2 py-2 align-top text-right text-[var(--text-primary)]">
          {formatNumber(consignment.weight ?? 0)} kg
        </td>
        <td className="px-2 py-2 align-top text-right text-[var(--text-primary)]">
          {(consignment.flm ?? 0).toFixed(1)}
        </td>
        <td className="px-2 py-2 align-top text-right text-[var(--text-primary)]">
          {extraDistanceKm != null
            ? `${formatDecimal(extraDistanceKm)} km`
            : "-"}
        </td>
        <td className="px-2 py-2 align-top text-right font-semibold text-[var(--text-primary)]">
          {revenue > 0 ? `${formatNumber(revenue)} kr` : "-"}
        </td>
        <td className="px-2 py-2 align-top text-[var(--text-primary)]">
          {shouldShowCalculatedParts &&
          data.simulatedProfitability !== undefined
            ? getRevenueStepText(data)
            : "-"}
        </td>
        <td className="px-2 py-2 align-top text-right font-semibold text-[var(--text-primary)]">
          {extraDrivingCost != null
            ? `${formatNumber(extraDrivingCost)} kr`
            : "-"}
        </td>
      </tr>
    );
  }

  function renderTableHeader(includeSource = false) {
    return (
      <thead className="sticky top-0 z-10 bg-[var(--primary-element)]">
        <tr className="border-b border-[var(--seperating-gray)] text-[10px] uppercase tracking-[0.035em] text-[var(--text-secondary)]">
          <th className="px-1.5 py-2 text-left w-8">Välj</th>
          <th className="px-1.5 py-2 text-left w-[18%]">Kund</th>
          {includeSource && (
            <th className="px-1.5 py-2 text-left w-[10%]">Ekipage</th>
          )}
          <th className="px-1.5 py-2 text-left w-[13%]">Hämtort</th>
          <th className="px-1.5 py-2 text-left w-[13%]">Mottagarort</th>
          <th className="px-1.5 py-2 text-left w-[14%]">Taxerelation</th>
          <th className="px-1.5 py-2 text-right">Vikt</th>
          <th className="px-1.5 py-2 text-right">FLM</th>
          <th className="px-1.5 py-2 text-right">Extra km</th>
          <th className="px-1.5 py-2 text-right">Intäkt</th>
          <th className="px-1.5 py-2 text-left">Steg</th>
          <th className="px-1.5 py-2 text-right min-w-[68px]">Kostnad</th>
        </tr>
      </thead>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text-primary)]">
      <Navigation currentPage="simulator" />

      <main className="flex-grow px-4 py-5 md:px-6 xl:px-8">
        <div className="mx-auto max-w-[1800px] space-y-5">
          <section className="overflow-hidden rounded-3xl border border-[var(--seperating-gray)] bg-[var(--primary-element)] shadow-sm">
            <div className="relative p-5 md:p-6">
              <div className="relative grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1.7fr] xl:items-end">
                <div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--seperating-gray)] bg-[var(--secondary-element)] px-3 py-1 text-[13px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                    Transport simulator
                  </div>
                  <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] md:text-4xl">
                    Simulera rutt, flytt och lönsamhet
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
                    Välj linje och ekipage, justera bokningar och kör
                    simuleringen från resultatpanelen.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <label className="space-y-1.5">
                    <span className="text-[13px] font-bold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                      Datum
                    </span>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(event) => setSelectedDate(event.target.value)}
                      className="h-11 w-full rounded-2xl border border-[var(--seperating-gray)] bg-[var(--primary-element)] px-4 text-sm font-medium text-[var(--text-primary)] outline-none transition focus:border-[var(--button-submit)] focus:ring-2 focus:ring-[var(--notification-color)]"
                    />
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-[13px] font-bold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                      Linje
                    </span>
                    <select
                      value={selectedLineId ?? ""}
                      onChange={(event) =>
                        setSelectedLineId(
                          event.target.value
                            ? Number(event.target.value)
                            : null,
                        )
                      }
                      disabled={!areasLoaded || isLoadingLines}
                      className="h-11 w-full rounded-2xl border border-[var(--seperating-gray)] bg-[var(--primary-element)] px-4 text-sm font-medium text-[var(--text-primary)] outline-none transition focus:border-[var(--button-submit)] focus:ring-2 focus:ring-[var(--notification-color)] disabled:opacity-60"
                    >
                      <option value="">Välj linje</option>
                      {availableLines.map((line) => (
                        <option key={line.id} value={line.id}>
                          {line.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-[13px] font-bold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                      Ekipage
                    </span>
                    <select
                      value={selectedEquipageId ?? ""}
                      onChange={(event) =>
                        setSelectedEquipageId(
                          event.target.value
                            ? Number(event.target.value)
                            : null,
                        )
                      }
                      disabled={!selectedLine || isLoadingEquipages}
                      className="h-11 w-full rounded-2xl border border-[var(--seperating-gray)] bg-[var(--primary-element)] px-4 text-sm font-medium text-[var(--text-primary)] outline-none transition focus:border-[var(--button-submit)] focus:ring-2 focus:ring-[var(--notification-color)] disabled:opacity-60"
                    >
                      <option value="">
                        {selectedLine ? "Välj ekipage" : "Välj linje först"}
                      </option>
                      {availableEquipages.map((equipage) => (
                        <option key={equipage.id} value={equipage.id}>
                          {equipage.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              {(errorMsg ||
                isLoadingLines ||
                isLoadingEquipages ||
                isLoadingUnassigned) && (
                <div className="relative mt-5 flex flex-wrap gap-2 text-sm">
                  {isLoadingLines && <StatusPill>Hämtar linjer...</StatusPill>}
                  {isLoadingEquipages && (
                    <StatusPill>Hämtar ekipage...</StatusPill>
                  )}
                  {isLoadingUnassigned && (
                    <StatusPill>Hämtar oplacerade bokningar...</StatusPill>
                  )}
                  {errorMsg && (
                    <span className="rounded-full border border-[var(--error)] bg-[var(--secondary-element)] px-3 py-1 font-semibold text-[var(--error)]">
                      {errorMsg}
                    </span>
                  )}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-[var(--seperating-gray)] bg-[var(--primary-element)] p-4 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <SectionEyebrow>Valt ekipage</SectionEyebrow>
                <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                  {selectedEquipage
                    ? selectedEquipage.name
                    : "Inget ekipage valt"}
                </h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {selectedEquipage
                    ? (selectedLine?.name ?? "Ingen linje vald")
                    : "Välj ekipage för att se nuvarande lastläge och kunna simulera byten."}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 xl:min-w-[520px]">
                <MetricCard
                  label="Aktiva bokningar"
                  value={`${activeCurrentEquipageSummary?.consignments.length ?? 0}`}
                />
                <MetricCard
                  label="Total vikt"
                  value={formatNumber(
                    activeCurrentEquipageSummary?.totalWeightKg ?? 0,
                  )}
                  suffix="kg"
                />
                <MetricCard
                  label="Nuvarande FLM"
                  value={(activeCurrentEquipageSummary?.totalFlm ?? 0).toFixed(
                    1,
                  )}
                />
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_390px]">
            <div className="space-y-5 min-w-0">
              <Panel>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <SectionEyebrow>Lastläge</SectionEyebrow>
                    <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                      Bokningar på valt ekipage
                    </h2>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      Avmarkera en befintlig bokning för att simulera att den
                      tas bort från ekipaget.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="rounded-2xl border border-[var(--seperating-gray)] bg-[var(--secondary-element)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)]">
                      {selectedEquipage
                        ? selectedEquipage.name
                        : "Inget ekipage valt"}
                    </div>
                    <CountChip>
                      {excludedCurrentConsignmentIds.length} bortvalda
                    </CountChip>
                    <button
                      type="button"
                      onClick={() => {
                        clearCurrentEquipageSelection();
                        resetCalculatedParts();
                      }}
                      disabled={excludedCurrentConsignmentIds.length === 0}
                      className={sectionActionButtonClass()}
                    >
                      Rensa val
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setIsCurrentEquipageBookingsOpen((isOpen) => !isOpen)
                      }
                      className={sectionActionButtonClass()}
                    >
                      {isCurrentEquipageBookingsOpen ? "Dölj" : "Visa"}
                    </button>
                  </div>
                </div>

                {isCurrentEquipageBookingsOpen &&
                  (!selectedEquipage ? (
                    <EmptyState title="Välj ekipage för att se bokningar." />
                  ) : isLoadingCurrentEquipage ? (
                    <EmptyState title="Hämtar ekipagets bokningar..." />
                  ) : !currentEquipageSummary ? (
                    <EmptyState title="Ingen data för ekipaget." />
                  ) : (
                    <>
                      <div className="mt-4 overflow-hidden rounded-3xl border border-[var(--seperating-gray)] bg-[var(--primary-element)]">
                        <table className="w-full table-fixed border-collapse text-xs leading-snug">
                          {renderTableHeader()}
                          <tbody>
                            {currentEquipageSummary.consignments.map(
                              (consignment) => {
                                const isIncluded =
                                  !excludedCurrentConsignmentIds.includes(
                                    consignment.consignmentId,
                                  );

                                return renderBookingRow({
                                  keyValue: consignment.consignmentId,
                                  consignment,
                                  isSelected: isIncluded,
                                  onToggle: () =>
                                    toggleCurrentConsignment(
                                      consignment.consignmentId,
                                    ),
                                  neutralWhenUnselected: true,
                                });
                              },
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ))}
              </Panel>

              <Panel>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <SectionEyebrow>Urval</SectionEyebrow>
                    <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                      Oplacerade bokningar
                    </h2>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      Markera bokningar som ska testas på valt ekipage.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CountChip>{selectedConsignmentIds.length} valda</CountChip>
                    <button
                      type="button"
                      onClick={() => {
                        clearUnassignedSelection();
                        resetCalculatedParts();
                      }}
                      disabled={selectedConsignmentIds.length === 0}
                      className={sectionActionButtonClass()}
                    >
                      Rensa val
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setIsUnassignedBookingsOpen((isOpen) => !isOpen)
                      }
                      className={sectionActionButtonClass()}
                    >
                      {isUnassignedBookingsOpen ? "Dölj" : "Visa"}
                    </button>
                  </div>
                </div>

                {isUnassignedBookingsOpen &&
                  (!selectedLine || !selectedDate ? (
                    <EmptyState title="Välj datum och linje för att visa bokningar." />
                  ) : unassignedConsignments.length === 0 &&
                    !isLoadingUnassigned ? (
                    <EmptyState title="Inga oplacerade bokningar hittades." />
                  ) : (
                    <div className="mt-4 overflow-hidden rounded-3xl border border-[var(--seperating-gray)] bg-[var(--primary-element)]">
                      <table className="w-full table-fixed border-collapse text-xs leading-snug">
                        {renderTableHeader()}
                        <tbody>
                          {unassignedConsignments.map((consignment) =>
                            renderBookingRow({
                              keyValue: consignment.consignmentId,
                              consignment,
                              isSelected: selectedConsignmentIds.includes(
                                consignment.consignmentId,
                              ),
                              onToggle: () =>
                                toggleConsignment(consignment.consignmentId),
                            }),
                          )}
                        </tbody>
                      </table>
                    </div>
                  ))}
              </Panel>

              <Panel>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <SectionEyebrow>Flytta in</SectionEyebrow>
                    <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                      Bokningar på andra ekipage
                    </h2>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      Välj lastlagda bokningar från andra ekipage som ska
                      simuleras på valt ekipage.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CountChip>
                      {selectedOtherEquipageConsignmentKeys.length} valda
                    </CountChip>
                    <button
                      type="button"
                      onClick={() => {
                        clearOtherEquipageSelection();
                        resetCalculatedParts();
                      }}
                      disabled={
                        selectedOtherEquipageConsignmentKeys.length === 0
                      }
                      className={sectionActionButtonClass()}
                    >
                      Rensa val
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setIsOtherEquipageBookingsOpen((isOpen) => !isOpen)
                      }
                      className={sectionActionButtonClass()}
                    >
                      {isOtherEquipageBookingsOpen ? "Dölj" : "Visa"}
                    </button>
                  </div>
                </div>

                {isOtherEquipageBookingsOpen &&
                  (!selectedEquipage ? (
                    <EmptyState title="Välj ekipage för att visa bokningar från andra ekipage." />
                  ) : isLoadingOtherEquipageConsignments ? (
                    <EmptyState title="Hämtar bokningar från andra ekipage..." />
                  ) : otherEquipageConsignments.length === 0 ? (
                    <EmptyState title="Inga bokningar hittades på andra ekipage för vald linje och dag." />
                  ) : (
                    <div className="mt-4 overflow-hidden rounded-3xl border border-[var(--seperating-gray)] bg-[var(--primary-element)]">
                      <table className="w-full table-fixed border-collapse text-xs leading-snug">
                        <thead className="sticky top-0 z-10 bg-[var(--primary-element)]">
                          <tr className="border-b border-[var(--seperating-gray)] text-[9px] uppercase tracking-[0.005em] text-[var(--text-secondary)]">
                            <th className="px-1 py-2 text-left w-[4%]">Välj</th>
                            <th className="px-1 py-2 text-left w-[14%]">
                              Kund
                            </th>
                            <th className="px-1 py-2 text-left w-[8%]">
                              Ekipage
                            </th>
                            <th className="px-1 py-2 text-left w-[12%]">
                              Hämtort
                            </th>
                            <th className="px-1 py-2 text-left w-[12%]">
                              Mottagarort
                            </th>
                            <th className="px-1 py-2 text-left w-[13%]">
                              Taxerelation
                            </th>
                            <th className="px-1 py-2 text-right w-[6%]">
                              Vikt
                            </th>
                            <th className="px-1 py-2 text-right w-[5%]">FLM</th>
                            <th className="px-1 py-2 text-right w-[7%]">
                              Extra km
                            </th>
                            <th className="px-1 py-2 text-right w-[6%]">
                              Intäkt
                            </th>
                            <th className="px-1 py-2 text-left w-[5%]">Steg</th>
                            <th className="pl-1 pr-3 py-2 text-right w-[8%] whitespace-nowrap">
                              Kostnad
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {otherEquipageConsignments.map((consignment) => {
                            const key =
                              getOtherEquipageConsignmentKey(consignment);
                            const data = consignment as BookingLike;
                            const shouldShowCalculatedParts =
                              showCalculatedParts &&
                              hasRowSimulationResult(data);
                            const revenue = shouldShowCalculatedParts
                              ? getRevenue(data)
                              : 0;
                            const extraDrivingCost = shouldShowCalculatedParts
                              ? data.extraDrivingCost
                              : null;
                            const extraDistanceKm = shouldShowCalculatedParts
                              ? data.extraDistanceKm
                              : null;
                            const isSelected =
                              selectedOtherEquipageConsignmentKeys.includes(
                                key,
                              );

                            return (
                              <tr
                                key={key}
                                className={`border-b border-[var(--seperating-gray)] transition hover:bg-[var(--secondary-element)] ${
                                  isSelected
                                    ? getSelectedConsignmentRowColor(
                                        revenue,
                                        extraDrivingCost,
                                      )
                                    : "bg-[var(--primary-element)]"
                                }`}
                              >
                                <td className="px-2 py-2 align-top">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() =>
                                      toggleOtherEquipageConsignment(key)
                                    }
                                    className="h-3.5 w-3.5 accent-[var(--button-submit)]"
                                  />
                                </td>
                                <td className="px-2 py-2 align-top font-semibold leading-snug text-[var(--text-primary)] whitespace-normal break-words">
                                  {getDisplayCustomerName(
                                    consignment as ConsignmentListItem,
                                  )}
                                </td>
                                <td className="px-2 py-2 align-top">
                                  <span className="inline-block rounded-full border border-[var(--seperating-gray)] bg-[var(--secondary-element)] px-1.5 py-0.5 text-[11px] font-bold leading-snug text-[var(--text-primary)] whitespace-normal break-words">
                                    {data.sourceEquipageName || "-"}
                                  </span>
                                </td>
                                <td className="px-2 py-2 align-top text-[var(--text-primary)]">
                                  {data.pickupLocationCity || "-"}
                                </td>
                                <td className="px-2 py-2 align-top text-[var(--text-primary)]">
                                  {data.destinationCity || "-"}
                                </td>
                                <td className="px-2 py-2 align-top">
                                  <span className="inline-block rounded-full border border-[var(--seperating-gray)] bg-[var(--secondary-element)] px-1.5 py-0.5 text-[11px] font-semibold leading-snug text-[var(--text-primary)] whitespace-normal break-words">
                                    {data.taxPointRelation?.trim() || "Saknas"}
                                  </span>
                                  {shouldShowCalculatedParts &&
                                    data.missingDistanceRelation && (
                                      <p className="mt-1 text-xs font-semibold text-[var(--error)]">
                                        Taxepoint {data.missingDistanceRelation}{" "}
                                        saknar avstånd.
                                      </p>
                                    )}
                                </td>
                                <td className="px-2 py-2 align-top text-right text-[var(--text-primary)]">
                                  {formatNumber(data.weight ?? 0)} kg
                                </td>
                                <td className="px-2 py-2 align-top text-right text-[var(--text-primary)]">
                                  {(data.flm ?? 0).toFixed(1)}
                                </td>
                                <td className="px-2 py-2 align-top text-right text-[var(--text-primary)]">
                                  {extraDistanceKm != null
                                    ? `${formatDecimal(extraDistanceKm)} km`
                                    : "-"}
                                </td>
                                <td className="px-2 py-2 align-top text-right font-semibold text-[var(--text-primary)]">
                                  {revenue > 0
                                    ? `${formatNumber(revenue)} kr`
                                    : "-"}
                                </td>
                                <td className="px-2 py-2 align-top text-[var(--text-primary)]">
                                  {shouldShowCalculatedParts &&
                                  data.simulatedProfitability !== undefined
                                    ? getRevenueStepText(data)
                                    : "-"}
                                </td>
                                <td className="px-2 py-2 align-top text-right font-semibold text-[var(--text-primary)]">
                                  {extraDrivingCost != null
                                    ? `${formatNumber(extraDrivingCost)} kr`
                                    : "-"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))}
              </Panel>

              <Panel>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <SectionEyebrow>Manuell simulering</SectionEyebrow>
                    <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                      Fiktiva bokningar
                    </h2>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      Lägg till en egen taxerelation med pris. Steg visas inte
                      eftersom intäkten anges manuellt.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CountChip>
                      {selectedFictitiousBookingIds.length} valda
                    </CountChip>
                    <button
                      type="button"
                      onClick={() => {
                        clearFictitiousSelection();
                        resetCalculatedParts();
                      }}
                      disabled={selectedFictitiousBookingIds.length === 0}
                      className={sectionActionButtonClass()}
                    >
                      Rensa val
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFictitiousFieldErrors({});
                        setIsFictitiousModalOpen(true);
                      }}
                      className="rounded-2xl border border-[var(--button-fetch)] bg-[var(--button-fetch)] px-3 py-2 text-sm font-semibold text-[var(--navbar)] shadow-sm transition hover:bg-[var(--button-fetch-hover)]"
                    >
                      Lägg till fiktiv bokning
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setIsFictitiousBookingsOpen((isOpen) => !isOpen)
                      }
                      className={sectionActionButtonClass()}
                    >
                      {isFictitiousBookingsOpen ? "Dölj" : "Visa"}
                    </button>
                  </div>
                </div>

                {isFictitiousBookingsOpen &&
                  (fictitiousBookings.length === 0 ? (
                    <EmptyState title="Inga fiktiva bokningar tillagda." />
                  ) : (
                    <div className="mt-4 overflow-hidden rounded-3xl border border-[var(--seperating-gray)] bg-[var(--primary-element)]">
                      <table className="w-full table-fixed border-collapse text-xs leading-snug">
                        <thead className="sticky top-0 z-10 bg-[var(--primary-element)]">
                          <tr className="border-b border-[var(--seperating-gray)] text-[10px] uppercase tracking-[0.035em] text-[var(--text-secondary)]">
                            <th className="px-1.5 py-2 text-left w-8">Välj</th>
                            <th className="px-1.5 py-2 text-left">
                              Taxerelation
                            </th>
                            <th className="px-1.5 py-2 text-right">Extra km</th>
                            <th className="px-1.5 py-2 text-right">Intäkt</th>
                            <th className="px-1.5 py-2 text-right min-w-[68px]">
                              Kostnad
                            </th>
                            <th className="px-1.5 py-2 text-right">Åtgärd</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fictitiousBookings.map((booking) => {
                            const isSelected =
                              selectedFictitiousBookingIds.includes(booking.id);
                            const data = booking as RevenueFields;
                            const shouldShowCalculatedParts =
                              showCalculatedParts &&
                              hasRowSimulationResult(data);
                            const revenue = shouldShowCalculatedParts
                              ? getRevenue(data)
                              : booking.price;
                            const extraDrivingCost = shouldShowCalculatedParts
                              ? data.extraDrivingCost
                              : null;
                            const extraDistanceKm = shouldShowCalculatedParts
                              ? data.extraDistanceKm
                              : null;

                            return (
                              <tr
                                key={booking.id}
                                className={`border-b border-[var(--seperating-gray)] transition hover:bg-[var(--secondary-element)] ${
                                  isSelected
                                    ? getSelectedConsignmentRowColor(
                                        revenue,
                                        extraDrivingCost,
                                      )
                                    : "bg-[var(--primary-element)]"
                                }`}
                              >
                                <td className="px-4 py-3">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() =>
                                      toggleFictitiousBooking(booking.id)
                                    }
                                    className="h-3.5 w-3.5 accent-[var(--button-submit)]"
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <span className="inline-block rounded-full border border-[var(--seperating-gray)] bg-[var(--secondary-element)] px-1.5 py-0.5 text-[11px] font-semibold leading-snug text-[var(--text-primary)] whitespace-normal break-words">
                                    {booking.taxPointRelation}
                                  </span>
                                  {shouldShowCalculatedParts &&
                                    data.missingDistanceRelation && (
                                      <p className="mt-1 text-xs font-semibold text-[var(--error)]">
                                        Taxepoint {data.missingDistanceRelation}{" "}
                                        saknar avstånd.
                                      </p>
                                    )}
                                </td>
                                <td className="px-1.5 py-2 text-right text-[var(--text-primary)]">
                                  {extraDistanceKm != null
                                    ? `${formatDecimal(extraDistanceKm)} km`
                                    : "-"}
                                </td>
                                <td className="px-1.5 py-2 text-right font-semibold text-[var(--text-primary)]">
                                  {formatNumber(revenue)} kr
                                </td>
                                <td className="px-1.5 py-2 text-right font-semibold text-[var(--text-primary)]">
                                  {extraDrivingCost != null
                                    ? `${formatNumber(extraDrivingCost)} kr`
                                    : "-"}
                                </td>
                                <td className="px-1.5 py-2 text-right">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeFictitiousBooking(booking.id)
                                    }
                                    className="text-sm font-bold text-[var(--error)] hover:underline"
                                  >
                                    Ta bort
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))}
              </Panel>
            </div>

            <aside className="2xl:sticky 2xl:top-5 h-fit space-y-5">
              <Panel className="border-[var(--seperating-gray)] bg-[var(--primary-element)] text-[var(--text-primary)] shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                      Simulering
                    </p>
                    <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                      Simulerad effekt
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                      Kör, rensa och återställ från samma panel.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[var(--seperating-gray)] bg-[var(--secondary-element)] px-3 py-2 text-right">
                    <p className="text-[13px] text-[var(--text-secondary)]">
                      Ändringar
                    </p>
                    <p className="text-xl font-bold text-[var(--text-primary)]">
                      {totalChangeCount}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={handleRunSimulation}
                    disabled={!selectedEquipageId || isSimulating}
                    className={sectionActionButtonClass(true)}
                  >
                    {isSimulating ? "Simulerar..." : "Simulera"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetSimulationResults();
                      resetCalculatedParts();
                    }}
                    disabled={!showCalculatedParts && totalChangeCount === 0}
                    className={sectionActionButtonClass()}
                  >
                    Återställ simulering
                  </button>
                </div>

                {!selectedEquipage ? (
                  <div className="mt-5 rounded-2xl border border-[var(--seperating-gray)] bg-[var(--secondary-element)] p-4 text-sm text-[var(--text-secondary)]">
                    Välj först ett ekipage.
                  </div>
                ) : (
                  <>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <DarkMetric
                        label="Tillagda"
                        value={`${selectedBookingCount}`}
                      />
                      <DarkMetric
                        label="Bortvalda"
                        value={`${excludedCurrentBookingCount}`}
                      />
                      <DarkMetric
                        label="Extra km"
                        value={formatDecimal(
                          displayedSimulationSummary.totalExtraDistanceKm,
                        )}
                        suffix="km"
                      />
                      <DarkMetric
                        label="Milpris"
                        value={formatNumber(milprisPerMil)}
                        suffix="kr/mil"
                      />
                      <DarkMetric
                        label="Körkostnad"
                        value={formatNumber(
                          displayedSimulationSummary.totalExtraDrivingCost,
                        )}
                        suffix="kr"
                      />
                      <DarkMetric
                        label="Intäkt"
                        value={formatNumber(
                          displayedSimulationSummary.totalEstimatedRevenue,
                        )}
                        suffix="kr"
                      />
                    </div>

                    <div className="mt-5 rounded-3xl border border-[var(--seperating-gray)] bg-[var(--secondary-element)] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="font-bold text-[var(--text-primary)]">
                            Intäktstäckning
                          </h3>
                          <p className="text-[13px] text-[var(--text-secondary)]">
                            Intäkt jämfört med extra körkostnad.
                          </p>
                        </div>
                        <span className="text-xl font-bold text-[var(--text-primary)]">
                          {formatDecimal(revenueCoveragePercent)}%
                        </span>
                      </div>
                      <div className="mt-4 h-3 overflow-hidden rounded-full bg-[var(--seperating-gray)]">
                        <div
                          className={`h-full rounded-full transition-all ${
                            revenueCoveragePercent >= 100
                              ? "bg-[var(--button-submit)]"
                              : revenueCoveragePercent >= 70
                                ? "bg-[var(--card-titel)]"
                                : "bg-[var(--error)]"
                          }`}
                          style={{ width: `${revenueCoveragePercent}%` }}
                        />
                      </div>
                      <div
                        className={`mt-4 rounded-2xl border px-3 py-2 text-sm font-bold text-[var(--text-primary)] ${getCoverageTone()}`}
                      >
                        {getCoverageLabel()}
                      </div>
                    </div>
                  </>
                )}
              </Panel>

              <Panel>
                <div>
                  <SectionEyebrow>Rutt</SectionEyebrow>
                  <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                    Föreslagen rutt
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
                    Stoppen visas i den ordning bilen föreslås köra. Hämtning
                    och leverans gäller bokningar som valts in i simuleringen.
                    Övriga stopp är platser som redan ingår i rutten.
                  </p>
                </div>

                {primaryRoute && proposedRouteEntries.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-3xl border border-[var(--seperating-gray)] bg-[var(--secondary-element)] p-3 text-[13px] text-[var(--text-secondary)]">
                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 shrink-0 rounded-full bg-[var(--button-fetch)]/25 ring-1 ring-[var(--button-fetch)]/35" />
                          <span>Hämta vald bokning</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 shrink-0 rounded-full bg-[var(--button-submit)]/25 ring-1 ring-[var(--button-submit)]/35" />
                          <span>Lämna vald bokning</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 shrink-0 rounded-full bg-[var(--seperating-gray)] ring-1 ring-[var(--border-primary)]/10" />
                          <span>Befintligt ruttstopp</span>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-3xl border border-[var(--seperating-gray)] bg-[var(--primary-element)] p-2">
                      {proposedRouteEntries.map((entry, displayIndex) => {
                        const stopLabel =
                          entry.type === "pickup"
                            ? "Hämtningsstopp"
                            : entry.type === "delivery"
                              ? "Leveransstopp"
                              : "Befintligt stopp";
                        const markerClass =
                          entry.type === "pickup"
                            ? "bg-[var(--button-fetch)]/25 ring-[var(--button-fetch)]/35"
                            : entry.type === "delivery"
                              ? "bg-[var(--button-submit)]/25 ring-[var(--button-submit)]/35"
                              : "bg-[var(--seperating-gray)] ring-[var(--border-primary)]/10";

                        return (
                          <div
                            key={entry.key}
                            className="mb-2 flex items-start gap-3 rounded-2xl border border-[var(--seperating-gray)] bg-[var(--primary-element)] px-3 py-3 text-sm text-[var(--text-primary)] last:mb-0"
                          >
                            <span
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-[var(--text-primary)] ring-1 ${markerClass}`}
                            >
                              {displayIndex + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <p className="font-bold text-[var(--text-primary)]">
                                  {stopLabel}
                                </p>
                                {entry.bookingCount > 1 && (
                                  <span className="rounded-full border border-[var(--seperating-gray)] bg-[var(--secondary-element)] px-2 py-0.5 text-[12px] font-bold text-[var(--text-primary)]">
                                    ×{entry.bookingCount}
                                  </span>
                                )}
                                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                                  Stop {displayIndex + 1}
                                </p>
                              </div>
                              <p className="mt-1 break-words text-[15px] font-semibold leading-snug text-[var(--text-primary)]">
                                {entry.location}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <EmptyState title="Kör simuleringen för att visa föreslagen rutt." />
                )}
              </Panel>
            </aside>
          </section>
        </div>
      </main>

      {isFictitiousModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--border-primary)]/40 px-4">
          <div className="w-full max-w-md rounded-3xl border border-[var(--seperating-gray)] bg-[var(--primary-element)] p-6 text-[var(--text-primary)] shadow-lg">
            <h2 className="text-xl font-bold tracking-tight">
              Lägg till fiktiv bokning
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Ange taxerelation och pris. Intäkten blir användarens pris.
            </p>

            <div className="mt-5 space-y-4">
              <label className="block">
                {fictitiousFieldErrors.taxPointRelation && (
                  <p className="mb-1 text-sm font-semibold text-[var(--error)]">
                    {fictitiousFieldErrors.taxPointRelation}
                  </p>
                )}
                <span className="mb-1 block text-[13px] font-bold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                  Taxerelation
                </span>
                <input
                  value={fictitiousTaxPointRelation}
                  onChange={(event) => {
                    setFictitiousTaxPointRelation(event.target.value);
                    setFictitiousFieldErrors((current) => ({
                      ...current,
                      taxPointRelation: undefined,
                    }));
                  }}
                  placeholder="Exempel: 78542-36441"
                  className="h-11 w-full rounded-2xl border border-[var(--seperating-gray)] bg-[var(--primary-element)] px-4 text-sm font-medium outline-none transition focus:border-[var(--button-submit)] focus:ring-2 focus:ring-[var(--notification-color)]"
                />
              </label>

              <label className="block">
                {fictitiousFieldErrors.price && (
                  <p className="mb-1 text-sm font-semibold text-[var(--error)]">
                    {fictitiousFieldErrors.price}
                  </p>
                )}
                <span className="mb-1 block text-[13px] font-bold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                  Pris
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={fictitiousPrice}
                  onChange={(event) => {
                    setFictitiousPrice(event.target.value);
                    setFictitiousFieldErrors((current) => ({
                      ...current,
                      price: undefined,
                    }));
                  }}
                  className="h-11 w-full rounded-2xl border border-[var(--seperating-gray)] bg-[var(--primary-element)] px-4 text-sm font-medium outline-none transition focus:border-[var(--button-submit)] focus:ring-2 focus:ring-[var(--notification-color)]"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setFictitiousFieldErrors({});
                  setIsFictitiousModalOpen(false);
                }}
                className="rounded-2xl border border-[var(--seperating-gray)] bg-[var(--primary-element)] px-4 py-2.5 text-sm font-bold text-[var(--text-primary)]"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={handleAddFictitiousBooking}
                disabled={isAddingFictitiousBooking}
                className="rounded-2xl border border-[var(--seperating-gray)] bg-[var(--secondary-element)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--seperating-gray)] hover:bg-[var(--primary-element)] disabled:bg-[var(--disabled-button)] disabled:text-[var(--text-hover)]"
              >
                {isAddingFictitiousBooking ? "Kontrollerar..." : "Lägg till"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-3xl border border-[var(--seperating-gray)] bg-[var(--primary-element)] p-5 shadow-sm md:p-6 ${className}`}
    >
      {children}
    </section>
  );
}

function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
      {children}
    </p>
  );
}

function StatusPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-[var(--seperating-gray)] bg-[var(--primary-element)] px-3 py-1 font-semibold text-[var(--text-primary)]">
      {children}
    </span>
  );
}

function CountChip({ children }: { children: ReactNode }) {
  return (
    <div className="w-fit rounded-2xl border border-[var(--seperating-gray)] bg-[var(--secondary-element)] px-4 py-2 text-sm font-bold text-[var(--text-primary)]">
      {children}
    </div>
  );
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className="mt-5 rounded-3xl border border-[var(--seperating-gray)] bg-[var(--primary-element)] p-6 text-sm font-semibold text-[var(--text-secondary)]">
      {title}
    </div>
  );
}

function MetricCard({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-3xl border border-[var(--seperating-gray)] bg-[var(--primary-element)] p-4">
      <p className="text-[13px] font-bold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
        {label}
      </p>
      <div className="mt-2 flex items-end gap-2">
        <p className="text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
          {value}
        </p>
        {suffix && (
          <p className="pb-1 text-sm font-semibold text-[var(--text-secondary)]">
            {suffix}
          </p>
        )}
      </div>
    </div>
  );
}

function DarkMetric({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-3xl border border-[var(--seperating-gray)] bg-[var(--primary-element)] p-4 shadow-sm">
      <p className="text-[13px] font-bold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
        {label}
      </p>
      <div className="mt-2 flex items-end gap-1">
        <p className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
          {value}
        </p>
        {suffix && (
          <p className="pb-0.5 text-xs font-semibold text-[var(--text-secondary)]">
            {suffix}
          </p>
        )}
      </div>
    </div>
  );
}
