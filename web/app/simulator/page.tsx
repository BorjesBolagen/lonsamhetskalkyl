"use client";

import { useState } from "react";

import Navigation from "../../components/Navigation";
import Footer from "../../components/Footer";
import { useSimulatorPlanner } from "./useSimulatorPlanner";

// Gemensamma fält som kan finnas på simulerade iLog-rader och fiktiva rader.
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

// Fält som behövs för att kunna markera pickup/leverans i föreslagen rutt.
type RouteMarkerFields = RevenueFields & {
  taxPointRelation?: string | null;
  pickupLocationCity?: string | null;
  destinationCity?: string | null;
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
    milprisPerMil,
  } = useSimulatorPlanner();

  const [showCalculatedParts, setShowCalculatedParts] = useState(false);

  // Aktiva befintliga bokningar är de som fortfarande ligger kvar på ekipaget i simuleringen.
  const selectedCurrentConsignments =
    activeCurrentEquipageSummary?.consignments ?? [];

  const selectedBookingCount =
    selectedCurrentConsignments.length +
    selectedConsignmentIds.length +
    selectedFictitiousBookingIds.length;
  const excludedCurrentBookingCount = excludedCurrentConsignmentIds.length;
  const totalChangeCount = selectedBookingCount + excludedCurrentBookingCount;

  // Visa bara beräknade rader efter att användaren faktiskt har kört simuleringen.
  const simulatedSelectedCurrentConsignments = showCalculatedParts
    ? selectedCurrentConsignments.filter((consignment) =>
        hasRowSimulationResult(consignment as RevenueFields),
      )
    : [];

  const simulatedSelectedConsignments = showCalculatedParts
    ? selectedConsignments.filter((consignment) => {
        const data = consignment as RevenueFields;
        return (
          data.extraDistanceKm !== undefined ||
          data.extraDrivingCost !== undefined ||
          data.simulatedProfitability !== undefined
        );
      })
    : [];

  const simulatedSelectedFictitiousBookings = showCalculatedParts
    ? selectedFictitiousBookings.filter((booking) =>
        hasRowSimulationResult(booking as RevenueFields),
      )
    : [];

  // Nya tillägg i rutten är oplacerade och fiktiva bokningar, inte befintliga ekipagebokningar.
  const simulatedAddedItems: RouteMarkerFields[] = [
    ...simulatedSelectedConsignments,
    ...simulatedSelectedFictitiousBookings,
  ];

  const simulatedSelectedItems: RouteMarkerFields[] = [
    ...simulatedSelectedCurrentConsignments,
    ...simulatedAddedItems,
  ];

  // Senast simulerade rad innehåller den mest kompletta optimerade rutten.
  const primaryRoute = [...simulatedSelectedItems].reverse().find((item) => {
    const data = item as RevenueFields;
    return (data.optimizedRouteStops?.length ?? 0) > 0;
  }) as (RouteMarkerFields & RevenueFields) | undefined;

  // Dölj totalsiffror tills en ny simulering har körts.
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

  const hasSimulationResult = simulatedSelectedConsignments.some(
    (consignment) => (consignment as RevenueFields).extraDrivingCost != null,
  );

  function formatNumber(value: number): string {
    return value.toLocaleString("sv-SE", {
      maximumFractionDigits: 0,
    });
  }

  function formatDecimal(value: number): string {
    return value.toLocaleString("sv-SE", {
      maximumFractionDigits: 1,
    });
  }

  function getRevenue(consignment: RevenueFields): number {
    return consignment.simulatedProfitability?.estimated_revenue ?? 0;
  }

  // Radfärg visar enkel marginalstatus: grön lönsam, röd olönsam, grå saknar kostnad.
  function getSelectedConsignmentRowColor(
    revenue: number,
    cost?: number | null,
  ): string {
    if (cost == null) {
      return "bg-gray-300/40";
    }

    if (revenue > cost) {
      return "bg-green-300/40";
    }

    if (cost > revenue) {
      return "bg-red-300/40";
    }

    return "bg-gray-300/40";
  }

  // Steg visas endast när intäkten kommer från prislogiken, inte från fiktivt användarpris.
  function getRevenueStepText(item: RevenueFields): string {
    if (
      consignment.simulatedProfitability?.estimated_revenue == null ||
      consignment.simulatedProfitability.estimated_revenue <= 0 ||
      consignment.revenueMatchStep == null
    ) {
      return "Inget steg gav träff";
    }

    return `Steg ${consignment.revenueMatchStep}`;
  }

  function getCoverageLabel(): string {
    if (!hasSimulationResult) {
      return "Kör simuleringen för att få prognos.";
    }

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
    if (!hasSimulationResult) {
      return "bg-[var(--secondary-element)] text-[var(--text-primary)]";
    }

    return displayedSimulationSummary.simulatedMargin >= 0
      ? "bg-[var(--notification-color)] text-[var(--text-primary)]"
      : "bg-red-100 text-red-800";
  }

  // Avgör om en rad har beräkningsdata nog för att visas i resultatdelen.
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

    if (!normalizedValue) {
      return;
    }

    markerMap.set(normalizedValue, (markerMap.get(normalizedValue) ?? 0) + 1);
  }

  function takeMarkerCandidate(
    markerMap: Map<string, number>,
    location: string,
  ): boolean {
    const normalizedLocation = normalizeRouteValue(location);

    for (const [candidate, count] of markerMap.entries()) {
      if (count <= 0) {
        continue;
      }

      const isMatch =
        normalizedLocation === candidate ||
        normalizedLocation.includes(candidate) ||
        candidate.includes(normalizedLocation);

      if (isMatch) {
        if (count === 1) {
          markerMap.delete(candidate);
        } else {
          markerMap.set(candidate, count - 1);
        }

        return true;
      }
    }

    return false;
  }

  // Markeringskartorna används för att bara färga varje valt stopp en gång.
  const selectedPickupMarkers = new Map<string, number>();
  const selectedDeliveryMarkers = new Map<string, number>();

  simulatedSelectedConsignments.forEach((consignment) => {
  simulatedAddedItems.forEach((item) => {
    const [pickupTaxPoint, deliveryTaxPoint] =
      consignment.taxPointRelation?.split("-").map((part) => part.trim()) ?? [];

    addMarkerCandidate(selectedPickupMarkers, pickupTaxPoint);
    addMarkerCandidate(selectedPickupMarkers, consignment.pickupLocationCity);

    addMarkerCandidate(selectedDeliveryMarkers, deliveryTaxPoint);
    addMarkerCandidate(selectedDeliveryMarkers, consignment.destinationCity);
  });

  // Bygger föreslagen rutt och markerar bara nya tillägg som pickup/leverans.
  const proposedRouteEntries = (primaryRoute?.optimizedRouteStops ?? []).map(
    (location, index) => {
      const isPickup = takeMarkerCandidate(selectedPickupMarkers, location);
      const isDelivery = !isPickup
        ? takeMarkerCandidate(selectedDeliveryMarkers, location)
        : false;
      const type = isPickup ? "pickup" : isDelivery ? "delivery" : "stop";

      return {
        key: `${index}-${location}`,
        index,
        type,
        location,
        isSimulatedBookingStop: type !== "stop",
      };
    },
  );

  // Kör simulering och visar därefter beräkningsdelarna.
  async function handleRunSimulation() {
    setShowCalculatedParts(true);
    await runSimulation();
  }

  // Döljer resultatet och rensar beräknade fält i hooken.
  function resetCalculatedParts() {
    setShowCalculatedParts(false);
  }

  // Lägger till fiktiv bokning från modal och visar fältfel direkt vid valideringsfel.
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

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <Navigation currentPage="simulator" />

      <main className="flex-grow p-4 xl:p-5 space-y-4 overflow-hidden">
        <section className="bg-[var(--primary-element)] rounded-2xl shadow-md border border-[var(--seperating-gray)] p-4">
          <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1.2fr_1.1fr] gap-4 items-end">
            <div className="space-y-1">
              <h1 className="text-2xl xl:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
                Simulator
              </h1>
              <p className="text-sm text-[var(--text-primary)] opacity-80 leading-5">
                Simulera extra körkostnad och intäkt för oplacerade bokningar.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 xl:col-span-2">
              <div className="space-y-1">
                <label
                  htmlFor="selectedDate"
                  className="block text-sm font-semibold text-[var(--text-primary)]"
                >
                  Datum
                </label>
                <input
                  id="selectedDate"
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  className="w-full text-[var(--text-primary)] border-2 border-[var(--input-border)] rounded-xl p-3 bg-[var(--secondary-element)]"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="selectedLine"
                  className="block text-sm font-semibold text-[var(--text-primary)]"
                >
                  Linje
                </label>
                <select
                  id="selectedLine"
                  value={selectedLineId ?? ""}
                  onChange={(event) =>
                    setSelectedLineId(
                      event.target.value ? Number(event.target.value) : null,
                    )
                  }
                  disabled={!areasLoaded || isLoadingLines}
                  className="w-full text-[var(--text-primary)] border-2 border-[var(--input-border)] rounded-xl p-3 bg-[var(--secondary-element)]"
                >
                  <option value="">Välj linje</option>
                  {availableLines.map((line) => (
                    <option key={line.id} value={line.id}>
                      {line.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="selectedEquipage"
                  className="block text-sm font-semibold text-[var(--text-primary)]"
                >
                  Ekipage
                </label>
                <select
                  id="selectedEquipage"
                  value={selectedEquipageId ?? ""}
                  onChange={(event) =>
                    setSelectedEquipageId(
                      event.target.value ? Number(event.target.value) : null,
                    )
                  }
                  disabled={!selectedLine || isLoadingEquipages}
                  className="w-full text-[var(--text-primary)] border-2 border-[var(--input-border)] rounded-xl p-3 bg-[var(--secondary-element)]"
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
              </div>
            </div>
          </div>

          {(errorMsg ||
            isLoadingLines ||
            isLoadingEquipages ||
            isLoadingUnassigned) && (
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              {isLoadingLines && (
                <span className="px-3 py-1 rounded-full bg-[var(--primary-color-background)] text-[var(--text-primary)] font-medium">
                  Hämtar linjer...
                </span>
              )}
              {isLoadingEquipages && (
                <span className="px-3 py-1 rounded-full bg-[var(--primary-color-background)] text-[var(--text-primary)] font-medium">
                  Hämtar ekipage...
                </span>
              )}
              {isLoadingUnassigned && (
                <span className="px-3 py-1 rounded-full bg-[var(--primary-color-background)] text-[var(--text-primary)] font-medium">
                  Hämtar oplacerade bokningar...
                </span>
              )}
              {errorMsg && (
                <span className="px-3 py-1 rounded-full bg-red-100 text-red-800 font-medium">
                  {errorMsg}
                </span>
              )}
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[0.85fr_1.55fr_0.9fr] gap-4 min-h-0 flex-1 items-start">
          <div className="bg-[var(--primary-element)] rounded-2xl shadow-md border border-[var(--seperating-gray)] p-4 flex flex-col min-h-0 h-full min-w-0">
            <div className="mb-4 min-w-0">
              <h2 className="text-xl font-bold text-[var(--text-primary)]">
                Valt ekipage
              </h2>
              <p className="text-sm text-[var(--text-primary)] opacity-80">
                Nuvarande bokningar före simulering.
              </p>
            </div>

            {!selectedEquipage ? (
              <div className="rounded-xl bg-[var(--secondary-element)] p-4 text-[var(--text-primary)]">
                Inget ekipage valt.
              </div>
            ) : isLoadingCurrentEquipage ? (
              <div className="rounded-xl bg-[var(--secondary-element)] p-4 text-[var(--text-primary)]">
                Hämtar ekipagets bokningar...
              </div>
            ) : !currentEquipageSummary ? (
              <div className="rounded-xl bg-[var(--secondary-element)] p-4 text-[var(--text-primary)]">
                Ingen data för ekipaget.
              </div>
            ) : (
              <div className="space-y-4 min-w-0">
                <div className="rounded-xl bg-[var(--secondary-element)] border border-[var(--seperating-gray)] p-4 min-w-0 overflow-hidden">
                  <p className="text-lg font-bold text-[var(--text-primary)] truncate">
                    {selectedEquipage.name}
                  </p>
                  <p className="text-sm text-[var(--text-primary)] opacity-80 break-words leading-5">
                    {selectedLine ? selectedLine.name : "Ingen linje vald"}
                  </p>
                </div>

                <div className="grid grid-cols-1 2xl:grid-cols-2 gap-3 min-w-0">
                  <div className="rounded-xl bg-[var(--secondary-element)] border border-[var(--seperating-gray)] p-4 min-w-0 overflow-hidden">
                    <p className="text-[11px] uppercase tracking-wide text-[var(--text-primary)] opacity-75 leading-4 break-words">
                      Bokningar
                    </p>
                    <p className="text-3xl 2xl:text-2xl font-bold text-[var(--text-primary)] leading-tight break-words">
                      {activeCurrentEquipageSummary?.consignments.length ?? 0}
                    </p>
                  </div>

                  <div className="rounded-xl bg-[var(--secondary-element)] border border-[var(--seperating-gray)] p-4 min-w-0 overflow-hidden">
                    <p className="text-[11px] uppercase tracking-wide text-[var(--text-primary)] opacity-75 leading-4 break-words">
                      Total vikt
                    </p>
                    <p className="text-3xl 2xl:text-2xl font-bold text-[var(--text-primary)] leading-tight break-words">
                      {formatNumber(
                        activeCurrentEquipageSummary?.totalWeightKg ?? 0,
                      )}
                    </p>
                    <p className="text-sm text-[var(--text-primary)] opacity-75">
                      kg
                    </p>
                  </div>

                  <div className="rounded-xl bg-[var(--secondary-element)] border border-[var(--seperating-gray)] p-4 min-w-0 overflow-hidden 2xl:col-span-2">
                    <p className="text-[11px] uppercase tracking-wide text-[var(--text-primary)] opacity-75 leading-4 break-words">
                      Nuvarande FLM
                    </p>
                    <p className="text-3xl 2xl:text-2xl font-bold text-[var(--text-primary)] leading-tight break-words">
                      {(activeCurrentEquipageSummary?.totalFlm ?? 0).toFixed(1)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-[var(--primary-element)] rounded-2xl shadow-md border border-[var(--seperating-gray)] p-4 flex flex-col min-h-0 h-full">
            <div className="mb-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">
                    Oplacerade bokningar
                  </h2>
                  <p className="text-sm text-[var(--text-primary)] opacity-80">
                    Markera bokningar att simulera på valt ekipage.
                  </p>
                </div>

                <div className="rounded-xl bg-[var(--notification-color)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)]">
                  {selectedBookingCount} tillägg / {excludedCurrentBookingCount}{" "}
                  bortvalda
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleRunSimulation}
                  disabled={
                    !selectedEquipageId ||
                    totalChangeCount === 0 ||
                    isSimulating
                  }
                  className="bg-[var(--button-submit)] hover:bg-[var(--button-submit-hover)] disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-xl transition"
                >
                  {isSimulating ? "Simulerar..." : "Simulera valda"}
                </button>

                <button
                  type="button"
                  onClick={clearSimulationSelection}
                  disabled={totalChangeCount === 0}
                  className="bg-[var(--button-reset)] hover:bg-[var(--button-reset-hover)] disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-xl transition"
                >
                  Rensa val
                </button>

                <button
                  type="button"
                  onClick={resetCalculatedParts}
                  disabled={!showCalculatedParts}
                  className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-xl transition"
                >
                  Återställ
                </button>
              </div>
            </div>

            {!selectedLine || !selectedDate ? (
              <div className="rounded-xl bg-[var(--secondary-element)] p-4 text-[var(--text-primary)]">
                Välj datum och linje för att visa bokningar.
              </div>
            ) : unassignedConsignments.length === 0 && !isLoadingUnassigned ? (
              <div className="rounded-xl bg-[var(--secondary-element)] p-4 text-[var(--text-primary)]">
                Inga oplacerade bokningar hittades.
              </div>
            ) : (
              <div className="overflow-auto flex-1 min-h-0 border border-[var(--seperating-gray)] rounded-2xl">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-[var(--primary-element)]">
                    <tr className="border-b border-[var(--seperating-gray)] text-[var(--text-primary)]">
                      <th className="text-left p-3 w-14">Välj</th>
                      <th className="text-left p-3">Kund</th>
                      <th className="text-left p-3">Hämtort</th>
                      <th className="text-left p-3">Mottagarort</th>
                      <th className="text-left p-3">Taxerelation</th>
                      <th className="text-right p-3">Vikt</th>
                      <th className="text-right p-3">FLM</th>
                      <th className="text-right p-3">Extra km</th>
                      <th className="text-right p-3">Intäkt</th>
                      <th className="text-left p-3">Steg</th>
                      <th className="text-right p-3">Kostnad</th>
                    </tr>
                  </thead>

                  <tbody>
                    {unassignedConsignments.map((consignment) => {
                      // Oplacerade rader färgas bara när de är valda och har simulerats.
                      const isSelected = selectedConsignmentIds.includes(
                        consignment.consignmentId,
                      );
                      const data = consignment as RevenueFields;
                      const shouldShowCalculatedParts =
                        showCalculatedParts && isSelected;
                      const revenue = shouldShowCalculatedParts
                        ? getRevenue(data)
                        : 0;
                      const extraDrivingCost = shouldShowCalculatedParts
                        ? data.extraDrivingCost
                        : null;
                      const extraDistanceKm = shouldShowCalculatedParts
                        ? data.extraDistanceKm
                        : null;
                      const rowColor = isSelected
                        ? getSelectedConsignmentRowColor(
                            revenue,
                            extraDrivingCost,
                          )
                        : "bg-[var(--primary-element)]";

                      return (
                        <tr
                          key={consignment.consignmentId}
                          className={`border-b border-[var(--seperating-gray)] transition ${rowColor}`}
                        >
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() =>
                                toggleConsignment(consignment.consignmentId)
                              }
                              className="h-4 w-4"
                            />
                          </td>

                          <td className="p-3 font-semibold text-[var(--text-primary)]">
                            {getDisplayCustomerName(consignment)}
                          </td>

                          <td className="p-3 text-[var(--text-primary)]">
                            {consignment.pickupLocationCity || "-"}
                          </td>

                          <td className="p-3 text-[var(--text-primary)]">
                            {consignment.destinationCity || "-"}
                          </td>

                          <td className="p-3 text-[var(--text-primary)]">
                            <span className="rounded-lg bg-[var(--secondary-element)] px-2 py-1 text-xs font-semibold">
                              {consignment.taxPointRelation?.trim() || "Saknas"}
                            </span>
                          </td>

                          <td className="p-3 text-right text-[var(--text-primary)]">
                            {(consignment.weight ?? 0).toFixed(0)}
                          </td>

                          <td className="p-3 text-right text-[var(--text-primary)]">
                            {(consignment.flm ?? 0).toFixed(1)}
                          </td>

                          <td className="p-3 text-right text-[var(--text-primary)]">
                            {extraDistanceKm != null
                              ? `${formatDecimal(extraDistanceKm)} km`
                              : "-"}
                          </td>

                          <td className="p-3 text-right font-semibold text-[var(--text-primary)]">
                            {revenue > 0 ? `${formatNumber(revenue)} kr` : "-"}
                          </td>

                          <td className="p-3 text-left text-[var(--text-primary)]">
                            {shouldShowCalculatedParts &&
                            data.simulatedProfitability !== undefined
                              ? getRevenueStepText(data)
                              : "-"}
                          </td>

                          <td className="p-3 text-right font-semibold text-[var(--text-primary)]">
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
            )}

            {selectedEquipage &&
              !isLoadingCurrentEquipage &&
              currentEquipageSummary && (
                <>
                  {/* Lista över befintliga bokningar på ekipaget. Ikryssade rader ingår i simulerad startrutt. */}
                  <div className="mt-4 rounded-2xl border border-[var(--seperating-gray)] overflow-hidden bg-[var(--primary-element)]">
                    <div className="p-3 border-b border-[var(--seperating-gray)] bg-[var(--secondary-element)]">
                      <h3 className="font-bold text-[var(--text-primary)]">
                        Bokningar på ekipaget
                      </h3>
                      <p className="text-xs text-[var(--text-primary)] opacity-75">
                        Ikryssade befintliga bokningar simuleras med samma
                        intäkts- och kostnadsberäkning som övriga valda
                        bokningar.
                      </p>
                    </div>

                    {currentEquipageSummary.consignments.length === 0 ? (
                      <p className="p-3 text-sm text-[var(--text-primary)]">
                        Inga bokningar finns på ekipaget för valt datum.
                      </p>
                    ) : (
                      <div className="max-h-96 overflow-auto">
                        <table className="w-full border-collapse text-xs">
                          <thead className="sticky top-0 z-10 bg-[var(--primary-element)]">
                            <tr className="border-b border-[var(--seperating-gray)] text-[var(--text-primary)]">
                              <th className="text-left p-2 w-12">Med</th>
                              <th className="text-left p-2">Kund</th>
                              <th className="text-left p-2">Hämtort</th>
                              <th className="text-left p-2">Mottagarort</th>
                              <th className="text-left p-2">Taxerelation</th>
                              <th className="text-right p-2">Vikt</th>
                              <th className="text-right p-2">FLM</th>
                              <th className="text-right p-2">Extra km</th>
                              <th className="text-right p-2">Intäkt</th>
                              <th className="text-left p-2">Steg</th>
                              <th className="text-right p-2">Kostnad</th>
                            </tr>
                          </thead>
                          <tbody>
                            {currentEquipageSummary.consignments.map(
                              (consignment) => {
                                // Avmarkerade befintliga bokningar hålls neutrala och räknas inte som tillägg.
                                const isIncluded =
                                  !excludedCurrentConsignmentIds.includes(
                                    consignment.consignmentId,
                                  );
                                const data = consignment as RevenueFields;
                                const shouldShowCalculatedParts =
                                  showCalculatedParts &&
                                  hasRowSimulationResult(data);
                                const revenue = shouldShowCalculatedParts
                                  ? getRevenue(data)
                                  : 0;
                                const extraDrivingCost =
                                  shouldShowCalculatedParts
                                    ? data.extraDrivingCost
                                    : null;
                                const extraDistanceKm =
                                  shouldShowCalculatedParts
                                    ? data.extraDistanceKm
                                    : null;
                                const rowColor = isIncluded && shouldShowCalculatedParts
                                  ? getSelectedConsignmentRowColor(
                                      revenue,
                                      extraDrivingCost,
                                    )
                                  : "bg-[var(--primary-element)]";

                                return (
                                  <tr
                                    key={consignment.consignmentId}
                                    className={`border-b border-[var(--seperating-gray)] ${rowColor}`}
                                  >
                                    <td className="p-2">
                                      <input
                                        type="checkbox"
                                        checked={isIncluded}
                                        onChange={() =>
                                          toggleCurrentConsignment(
                                            consignment.consignmentId,
                                          )
                                        }
                                        className="h-4 w-4"
                                      />
                                    </td>
                                    <td className="p-2 font-semibold text-[var(--text-primary)]">
                                      {getDisplayCustomerName(consignment)}
                                    </td>
                                    <td className="p-2 text-[var(--text-primary)]">
                                      {consignment.pickupLocationCity || "-"}
                                    </td>
                                    <td className="p-2 text-[var(--text-primary)]">
                                      {consignment.destinationCity || "-"}
                                    </td>
                                    <td className="p-2 text-[var(--text-primary)]">
                                      <span className="rounded-lg bg-[var(--secondary-element)] px-2 py-1 text-xs font-semibold">
                                        {consignment.taxPointRelation?.trim() ||
                                          "Saknas"}
                                      </span>
                                      {shouldShowCalculatedParts &&
                                        data.missingDistanceRelation && (
                                          <p className="mt-1 text-xs font-semibold text-red-700">
                                            Taxepoint{" "}
                                            {data.missingDistanceRelation} finns
                                            inte, kan inte beräkna avstånd.
                                          </p>
                                        )}
                                    </td>
                                    <td className="p-2 text-right text-[var(--text-primary)]">
                                      {formatNumber(consignment.weight ?? 0)} kg
                                    </td>
                                    <td className="p-2 text-right text-[var(--text-primary)]">
                                      {(consignment.flm ?? 0).toFixed(1)}
                                    </td>
                                    <td className="p-2 text-right text-[var(--text-primary)]">
                                      {extraDistanceKm != null
                                        ? `${formatDecimal(extraDistanceKm)} km`
                                        : "-"}
                                    </td>
                                    <td className="p-2 text-right font-semibold text-[var(--text-primary)]">
                                      {shouldShowCalculatedParts
                                        ? `${formatNumber(revenue)} kr`
                                        : "-"}
                                    </td>
                                    <td className="p-2 text-left text-[var(--text-primary)]">
                                      {shouldShowCalculatedParts &&
                                      data.simulatedProfitability !== undefined
                                        ? getRevenueStepText(data)
                                        : "-"}
                                    </td>
                                    <td className="p-2 text-right font-semibold text-[var(--text-primary)]">
                                      {extraDrivingCost != null
                                        ? `${formatNumber(extraDrivingCost)} kr`
                                        : "-"}
                                    </td>
                                  </tr>
                                );
                              },
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            <div className="mt-4 rounded-2xl border border-[var(--seperating-gray)] bg-[var(--secondary-element)] p-4">
              <div className="flex items-center justify-between gap-4 mb-3">
                <div>
                  <h3 className="text-lg font-bold text-[var(--text-primary)]">
                    Fiktiva bokningar
                  </h3>
                  <p className="text-sm text-[var(--text-primary)] opacity-80">
                    Simuleras med angivet pris och taxerelation.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setFictitiousFieldErrors({});
                    setIsFictitiousModalOpen(true);
                  }}
                  className="bg-[var(--button-fetch)] hover:opacity-90 text-[var(--text-primary)] font-bold py-2 px-4 rounded-xl transition border border-[var(--seperating-gray)]"
                >
                  Lägg till fiktiv bokning
                </button>
              </div>

              {fictitiousBookings.length === 0 ? (
                <p className="text-sm text-[var(--text-primary)]">
                  Inga fiktiva bokningar tillagda.
                </p>
              ) : (
                <div className="overflow-auto border border-[var(--seperating-gray)] rounded-2xl bg-[var(--primary-element)]">
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-[var(--primary-element)]">
                      <tr className="border-b border-[var(--seperating-gray)] text-[var(--text-primary)]">
                        <th className="text-left p-3 w-14">Välj</th>
                        <th className="text-left p-3">Taxerelation</th>
                        <th className="text-right p-3">Extra km</th>
                        <th className="text-right p-3">Intäkt</th>
                        <th className="text-right p-3">Kostnad</th>
                        <th className="text-right p-3">Åtgärd</th>
                      </tr>
                    </thead>

                    <tbody>
                      {fictitiousBookings.map((booking) => {
                        // Fiktiva rader använder användarens pris som intäkt och saknar prissteg.
                        const isSelected =
                          selectedFictitiousBookingIds.includes(booking.id);
                        const data = booking as RevenueFields;
                        const shouldShowCalculatedParts =
                          showCalculatedParts && hasRowSimulationResult(data);
                        const revenue = shouldShowCalculatedParts
                          ? getRevenue(data)
                          : booking.price;
                        const extraDrivingCost = shouldShowCalculatedParts
                          ? data.extraDrivingCost
                          : null;
                        const extraDistanceKm = shouldShowCalculatedParts
                          ? data.extraDistanceKm
                          : null;
                        const rowColor = isSelected
                          ? getSelectedConsignmentRowColor(
                              revenue,
                              extraDrivingCost,
                            )
                          : "bg-[var(--primary-element)]";

                        return (
                          <tr
                            key={booking.id}
                            className={`border-b border-[var(--seperating-gray)] transition ${rowColor}`}
                          >
                            <td className="p-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() =>
                                  toggleFictitiousBooking(booking.id)
                                }
                                className="h-4 w-4"
                              />
                            </td>

                            <td className="p-3 text-[var(--text-primary)]">
                              <span className="rounded-lg bg-[var(--secondary-element)] px-2 py-1 text-xs font-semibold">
                                {booking.taxPointRelation}
                              </span>
                              {shouldShowCalculatedParts &&
                                data.missingDistanceRelation && (
                                  <p className="mt-1 text-xs font-semibold text-red-700">
                                    Taxepoint {data.missingDistanceRelation}{" "}
                                    finns inte, kan inte beräkna avstånd.
                                  </p>
                                )}
                            </td>

                            <td className="p-3 text-right text-[var(--text-primary)]">
                              {extraDistanceKm != null
                                ? `${formatDecimal(extraDistanceKm)} km`
                                : "-"}
                            </td>

                            <td className="p-3 text-right font-semibold text-[var(--text-primary)]">
                              {formatNumber(revenue)} kr
                            </td>

                            <td className="p-3 text-right font-semibold text-[var(--text-primary)]">
                              {extraDrivingCost != null
                                ? `${formatNumber(extraDrivingCost)} kr`
                                : "-"}
                            </td>

                            <td className="p-3 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  removeFictitiousBooking(booking.id)
                                }
                                className="text-sm font-bold text-red-700 hover:underline"
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
              )}
            </div>
          </div>

          <div className="bg-[var(--primary-element)] rounded-2xl shadow-md border border-[var(--seperating-gray)] p-4 flex flex-col min-h-0 h-full">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-[var(--text-primary)]">
                Simulerad effekt
              </h2>
              <p className="text-sm text-[var(--text-primary)] opacity-80">
                Intäkt jämförd med extra körkostnad.
              </p>
            </div>

            {!selectedEquipage ? (
              <div className="rounded-xl bg-[var(--secondary-element)] p-4 text-[var(--text-primary)]">
                Välj först ett ekipage.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-[var(--secondary-element)] border border-[var(--seperating-gray)] p-4">
                    <p className="text-xs uppercase tracking-wide text-[var(--text-primary)] opacity-75">
                      Tillagda bokningar
                    </p>
                    <p className="text-2xl font-bold text-[var(--text-primary)]">
                      {selectedBookingCount}
                    </p>
                  </div>

                  <div className="rounded-xl bg-[var(--secondary-element)] border border-[var(--seperating-gray)] p-4">
                    <p className="text-xs uppercase tracking-wide text-[var(--text-primary)] opacity-75">
                      Milpris
                    </p>
                    <p className="text-2xl font-bold text-[var(--text-primary)]">
                      {formatNumber(milprisPerMil)}
                    </p>
                    <p className="text-sm text-[var(--text-primary)] opacity-75">
                      kr/mil
                    </p>
                  </div>

                  <div className="rounded-xl bg-[var(--secondary-element)] border border-[var(--seperating-gray)] p-4">
                    <p className="text-xs uppercase tracking-wide text-[var(--text-primary)] opacity-75">
                      Extra km
                    </p>
                    <p className="text-2xl font-bold text-[var(--text-primary)]">
                      {formatDecimal(
                        displayedSimulationSummary.totalExtraDistanceKm,
                      )}
                    </p>
                    <p className="text-sm text-[var(--text-primary)] opacity-75">
                      km
                    </p>
                  </div>

                  <div className="rounded-xl bg-[var(--secondary-element)] border border-[var(--seperating-gray)] p-4">
                    <p className="text-xs uppercase tracking-wide text-[var(--text-primary)] opacity-75">
                      Körkostnad
                    </p>
                    <p className="text-2xl font-bold text-[var(--text-primary)]">
                      {formatNumber(
                        displayedSimulationSummary.totalExtraDrivingCost,
                      )}
                    </p>
                    <p className="text-sm text-[var(--text-primary)] opacity-75">
                      kr
                    </p>
                  </div>

                  <div className="rounded-xl bg-[var(--secondary-element)] border border-[var(--seperating-gray)] p-4 col-span-2">
                    <p className="text-xs uppercase tracking-wide text-[var(--text-primary)] opacity-75">
                      Total intäkt
                    </p>
                    <p className="text-2xl font-bold text-[var(--text-primary)]">
                      {formatNumber(
                        displayedSimulationSummary.totalEstimatedRevenue,
                      )}
                    </p>
                    <p className="text-sm text-[var(--text-primary)] opacity-75">
                      kr
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl bg-[var(--secondary-element)] border border-[var(--seperating-gray)] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-[var(--text-primary)]">
                        Intäktstäckning
                      </h3>
                      <p className="text-sm text-[var(--text-primary)] opacity-80">
                        Visar hur stor del av körkostnaden som täcks av
                        intäkten.
                      </p>
                    </div>
                    <span className="text-xl font-bold text-[var(--text-primary)]">
                      {formatDecimal(revenueCoveragePercent)}%
                    </span>
                  </div>

                  <div className="h-8 overflow-hidden rounded-full bg-[var(--primary-element)] border border-[var(--seperating-gray)]">
                    <div
                      className={`h-full rounded-full transition-all ${
                        revenueCoveragePercent >= 100
                          ? "bg-[var(--notification-color)]"
                          : revenueCoveragePercent >= 70
                            ? "bg-yellow-300"
                            : "bg-red-300"
                      }`}
                      style={{ width: `${revenueCoveragePercent}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-[var(--primary-element)] p-3">
                      <p className="text-xs uppercase opacity-70">Intäkt</p>
                      <p className="font-bold text-[var(--text-primary)]">
                        {formatNumber(
                          displayedSimulationSummary.totalEstimatedRevenue,
                        )}{" "}
                        kr
                      </p>
                    </div>

                    <div className="rounded-xl bg-[var(--primary-element)] p-3">
                      <p className="text-xs uppercase opacity-70">Kostnad</p>
                      <p className="font-bold text-[var(--text-primary)]">
                        {formatNumber(
                          displayedSimulationSummary.totalExtraDrivingCost,
                        )}{" "}
                        kr
                      </p>
                    </div>
                  </div>

                  <div
                    className={`rounded-xl px-4 py-3 text-center font-semibold ${getCoverageTone()}`}
                  >
                    {getCoverageLabel()}
                  </div>
                </div>

                {primaryRoute && proposedRouteEntries.length > 0 ? (
                  <div className="rounded-2xl bg-[var(--secondary-element)] border border-[var(--seperating-gray)] p-4 space-y-3">
                    <div>
                      <h3 className="text-lg font-bold text-[var(--text-primary)]">
                        Föreslagen rutt
                      </h3>
                      <p className="text-sm text-[var(--text-primary)] opacity-80">
                        Visar hela rutten. Bara nya bokningar markeras som pickup
                        och delivery.
                      </p>
                    </div>

                    <div className="max-h-72 overflow-auto rounded-xl border border-[var(--seperating-gray)] bg-[var(--primary-element)]">
                      {proposedRouteEntries.map((entry, displayIndex) => (
                        <div
                          key={entry.key}
                          className={`flex items-center gap-3 px-3 py-2 border-b border-[var(--seperating-gray)] text-sm ${
                            entry.isSimulatedBookingStop
                              ? "bg-gray-300/40 font-semibold"
                              : "bg-[var(--primary-element)]"
                          }`}
                        >
                          <span className="h-7 w-7 rounded-full bg-[var(--secondary-element)] flex items-center justify-center text-xs font-bold">
                            {displayIndex + 1}
                          </span>
                          <div className="min-w-0 text-[var(--text-primary)]">
                            <p className="truncate">
                              {entry.type === "pickup"
                                ? "Pickup"
                                : entry.type === "delivery"
                                  ? "Delivery"
                                  : "Stop"}
                              : {entry.location}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-[var(--secondary-element)] p-4 text-[var(--text-primary)] text-sm">
                    Kör simuleringen för att visa föreslagen rutt.
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
