"use client";

import Navigation from "../../components/Navigation";
import Footer from "../../components/Footer";
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

  const selectedBookingCount = selectedConsignmentIds.length;

  const simulatedSelectedConsignments = selectedConsignments.filter(
    (consignment) => {
      const data = consignment as RevenueFields;
      return (
        data.extraDistanceKm !== undefined ||
        data.extraDrivingCost !== undefined ||
        data.simulatedProfitability !== undefined
      );
    },
  );

  const primaryRoute = [...simulatedSelectedConsignments]
    .reverse()
    .find((consignment) => {
      const data = consignment as RevenueFields;
      return (data.optimizedRouteStops?.length ?? 0) > 0;
    }) as (typeof simulatedSelectedConsignments[number] & RevenueFields) | undefined;

  const revenueCoveragePercent =
    simulationSummary.totalExtraDrivingCost > 0
      ? Math.min(
          100,
          (simulationSummary.totalEstimatedRevenue /
            simulationSummary.totalExtraDrivingCost) *
            100,
        )
      : simulationSummary.totalEstimatedRevenue > 0
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

  function getRevenueStepText(consignment: RevenueFields): string {
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

    if (simulationSummary.totalEstimatedRevenue <= 0) {
      return "Inget steg gav träff";
    }

    if (simulationSummary.simulatedMargin >= 0) {
      return `Prognos: lönsam med ${formatNumber(
        simulationSummary.simulatedMargin,
      )} kr i marginal.`;
    }

    return `Prognos: inte lönsam. Saknar ${formatNumber(
      Math.abs(simulationSummary.simulatedMargin),
    )} kr.`;
  }

  function getCoverageTone(): string {
    if (!hasSimulationResult) {
      return "bg-[var(--secondary-element)] text-[var(--text-primary)]";
    }

    return simulationSummary.simulatedMargin >= 0
      ? "bg-[var(--notification-color)] text-[var(--text-primary)]"
      : "bg-red-100 text-red-800";
  }

  function getRouteStopLabel(stop: string, index: number): string {
    if (index === primaryRoute?.insertionPickupIndex) {
      return `Pickup: ${stop}`;
    }

    if (index === primaryRoute?.insertionDeliveryIndex) {
      return `Delivery: ${stop}`;
    }

    return `Stopp: ${stop}`;
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
                  <option value="">Välj ekipage</option>
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
                      {currentEquipageSummary.consignments.length}
                    </p>
                  </div>

                  <div className="rounded-xl bg-[var(--secondary-element)] border border-[var(--seperating-gray)] p-4 min-w-0 overflow-hidden">
                    <p className="text-[11px] uppercase tracking-wide text-[var(--text-primary)] opacity-75 leading-4 break-words">
                      Total vikt
                    </p>
                    <p className="text-3xl 2xl:text-2xl font-bold text-[var(--text-primary)] leading-tight break-words">
                      {formatNumber(currentEquipageSummary.totalWeightKg)}
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
                      {currentEquipageSummary.totalFlm.toFixed(1)}
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
                  {selectedBookingCount} valda
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={runSimulation}
                  disabled={
                    !selectedEquipageId ||
                    selectedBookingCount === 0 ||
                    isSimulating
                  }
                  className="bg-[var(--button-submit)] hover:bg-[var(--button-submit-hover)] disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-xl transition"
                >
                  {isSimulating ? "Simulerar..." : "Simulera valda"}
                </button>

                <button
                  type="button"
                  onClick={clearSimulationSelection}
                  disabled={selectedBookingCount === 0}
                  className="bg-[var(--button-reset)] hover:bg-[var(--button-reset-hover)] disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-xl transition"
                >
                  Rensa val
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
                      const isSelected = selectedConsignmentIds.includes(
                        consignment.consignmentId,
                      );
                      const data = consignment as RevenueFields;
                      const revenue = getRevenue(data);

                      return (
                        <tr
                          key={consignment.consignmentId}
                          className={`border-b border-[var(--seperating-gray)] transition ${
                            isSelected
                              ? "bg-[var(--primary-color-background)]/40"
                              : "bg-[var(--primary-element)]"
                          }`}
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
                            {data.extraDistanceKm != null
                              ? `${formatDecimal(data.extraDistanceKm)} km`
                              : "-"}
                          </td>

                          <td className="p-3 text-right font-semibold text-[var(--text-primary)]">
                            {revenue > 0 ? `${formatNumber(revenue)} kr` : "-"}
                          </td>

                          <td className="p-3 text-left text-[var(--text-primary)]">
                            {data.simulatedProfitability !== undefined
                              ? getRevenueStepText(data)
                              : "-"}
                          </td>

                          <td className="p-3 text-right font-semibold text-[var(--text-primary)]">
                            {data.extraDrivingCost != null
                              ? `${formatNumber(data.extraDrivingCost)} kr`
                              : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
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
                      Valda bokningar
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
                      {formatDecimal(simulationSummary.totalExtraDistanceKm)}
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
                      {formatNumber(simulationSummary.totalExtraDrivingCost)}
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
                      {formatNumber(simulationSummary.totalEstimatedRevenue)}
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
                        {formatNumber(simulationSummary.totalEstimatedRevenue)}{" "}
                        kr
                      </p>
                    </div>
                    <div className="rounded-xl bg-[var(--primary-element)] p-3">
                      <p className="text-xs uppercase opacity-70">Kostnad</p>
                      <p className="font-bold text-[var(--text-primary)]">
                        {formatNumber(simulationSummary.totalExtraDrivingCost)}{" "}
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

                {primaryRoute ? (
                  <div className="rounded-2xl bg-[var(--secondary-element)] border border-[var(--seperating-gray)] p-4 space-y-3">
                    <div>
                      <h3 className="text-lg font-bold text-[var(--text-primary)]">
                        Föreslagen rutt
                      </h3>
                      <p className="text-sm text-[var(--text-primary)] opacity-80">
                        Pickup ligger alltid före delivery.
                      </p>
                    </div>

                    <div className="max-h-72 overflow-auto rounded-xl border border-[var(--seperating-gray)] bg-[var(--primary-element)]">
                      {(primaryRoute.optimizedRouteStops ?? []).map(
                        (stop, index) => (
                          <div
                            key={`${stop}-${index}`}
                            className={`flex items-center gap-3 px-3 py-2 border-b border-[var(--seperating-gray)] text-sm ${
                              index === primaryRoute.insertionPickupIndex ||
                              index === primaryRoute.insertionDeliveryIndex
                                ? "bg-[var(--notification-color)]/60 font-semibold"
                                : ""
                            }`}
                          >
                            <span className="h-7 w-7 rounded-full bg-[var(--secondary-element)] flex items-center justify-center text-xs font-bold">
                              {index + 1}
                            </span>
                            <span className="text-[var(--text-primary)]">
                              {getRouteStopLabel(stop, index)}
                            </span>
                          </div>
                        ),
                      )}
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
