"use client";

import Navigation from "../../components/Navigation";
import Footer from "../../components/Footer";
import LineCard from "../../components/LineCard";
import EquipageCard from "../../components/EquipageCard";
import { getDisplayCustomerName, useHomeLines } from "./useHomeLines";

const STANDARD_FLM = 19.2;

export default function Home() {
  /**
   * Home is the presentation layer: it renders cards/popup and delegates data logic to useHomeLines.
   */
  const {
    selectedDate,
    setSelectedDate,
    profitabilityReferenceValue,
    lineCards,
    loadingLines,
    loadingProfitabilityCount,
    lineError,
    hasLoadedLines,
    visibleEquipageCount,
    appliedClusterLabels,
    selectedEquipage,
    isPopupOpen,
    areasLoaded,
    refreshingEquipages,
    refreshingLines,
    loadLines,
    clearDisplayedLines,
    openPopup,
    closePopup,
    refreshEquipageConsignments,
    refreshLineConsignments,
  } = useHomeLines();

  /**
   * Converts total FLM into bar progress.
   * 19.2 FLM should be 90%, and overflow fills the final 10%.
   */
  function convertFlmToBarProgress(totalFlm: number): number {
    if (totalFlm <= 0) {
      return 0;
    }

    if (totalFlm <= STANDARD_FLM) {
      return Math.max(0, Math.min(100, (totalFlm / STANDARD_FLM) * 90));
    }

    return 100;
  }

  /**
   * Converts prognosis amount into bar progress using user-configurable reference value.
   */
  function convertProfitToBarProgress(totalPrognosis: number): number {
    if (!Number.isFinite(totalPrognosis) || totalPrognosis <= 0) {
      return 0;
    }

    const reference =
      profitabilityReferenceValue > 0 ? profitabilityReferenceValue : 15000;
    return Math.max(0, Math.min(100, (totalPrognosis / reference) * 100));
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <Navigation currentPage="home" />

      <main className="flex-grow p-6 flex gap-6">
        <div className="flex-grow">
          {/* Left column: grouped lines with equipage cards. */}
          {!lineError && lineCards.length > 0 && (
            <div className="space-y-3">
              {lineCards.map((line) => (
                <LineCard
                  key={`${line.id}-${line.name}`}
                  title={`${line.name} (${line.id})`}
                  onRefresh={() => refreshLineConsignments(line.id)}
                  isRefreshing={refreshingLines.has(line.id)}
                >
                  <div className="flex flex-wrap gap-4 items-start w-full">
                    {line.equipages.map((equipage) => {
                      const isProfitabilityLoading =
                        equipage.profitabilityStatus === "idle" ||
                        equipage.profitabilityStatus === "loading";

                      return (
                        <EquipageCard
                          key={`${line.id}-${equipage.id}`}
                          title={equipage.name}
                          capacity={convertFlmToBarProgress(equipage.totalFlm)}
                          price={convertProfitToBarProgress(
                            equipage.totalProfitabilityPrice,
                          )}
                          priceLoading={isProfitabilityLoading}
                          onRefresh={() =>
                            refreshEquipageConsignments(equipage.id)
                          }
                          isRefreshing={refreshingEquipages.has(equipage.id)}
                        >
                          <button
                            type="button"
                            className="w-full text-sm"
                            onClick={() => openPopup(equipage)}
                          >
                            Info
                          </button>
                        </EquipageCard>
                      );
                    })}
                  </div>
                </LineCard>
              ))}
            </div>
          )}
        </div>

        <div className="w-[25rem] space-y-6 ml-auto">
          {/* Right column: controls + status summary for current fetch context. */}
          <div className="bg-[var(--primary-element)] rounded-xl shadow-md p-6 w-full max-w-none space-y-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                Aktuella linjer
              </p>
              {!areasLoaded && (
                <p className="text-sm text-[var(--text-primary)] mt-1">
                  Laddar dina sparade områden...
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <div className="space-y-1">
                <label
                  htmlFor="selectedDate"
                  className="block text-sm font-medium text-[var(--text-primary)]"
                >
                  Datum för filtrering
                </label>
                <input
                  id="selectedDate"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full text-[var(--text-primary)] border-2 border-[var(--border-primary)] rounded p-2 focus:outline-none focus:ring-2 focus:ring-green-700"
                />
              </div>

              <button
                onClick={loadLines}
                disabled={!areasLoaded || loadingLines}
                className="w-full bg-[var(--button-submit)] hover:bg-[var(--button-submit-hover)] disabled:bg-gray-400 text-white font-bold py-4 px-6 rounded-lg transition-colors duration-300 text-lg shadow-md inline-flex items-center justify-center gap-2"
              >
                {loadingLines && (
                  <span
                    className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin"
                    aria-hidden="true"
                  />
                )}
                <span>
                  {loadingLines
                    ? "Hämtar linjer, ekipage och bokningar..."
                    : "Hämta filtrerade linjer"}
                </span>
              </button>
            </div>

            <div className="text-sm text-[var(--primary-text)]">
              {loadingLines ? null : !areasLoaded ? (
                <p className="text-[var(--text-primary)]">
                  Vänta tills inställningarna har laddats.
                </p>
              ) : lineError ? (
                <p className="text-[var(--error)]">{lineError}</p>
              ) : !hasLoadedLines ? (
                <p className="text-[var(--text-primary)]">
                  Klicka på knappen för att ladda linjerna.
                </p>
              ) : lineCards.length > 0 ? (
                <div className="text-[var(--text-primary)] space-y-1 leading-6">
                  <p>
                    Från val
                    {appliedClusterLabels.length === 1
                      ? "t kluster "
                      : "da kluster "}
                    {appliedClusterLabels.length > 0
                      ? appliedClusterLabels.join(", ")
                      : " inga valda kluster"}{" "}
                    hittades {lineCards.length} linjer med totalt{" "}
                    {visibleEquipageCount} ekipage
                    {selectedDate ? ` för ${selectedDate}.` : "."}
                  </p>
                  {loadingProfitabilityCount > 0 && (
                    <p>
                      Pris beräknas fortfarande för {loadingProfitabilityCount}{" "}
                      ekipage.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <p>Inga linjer matchade dina valda kluster.</p>
                  <p>
                    Kluster:{" "}
                    {appliedClusterLabels.length > 0
                      ? appliedClusterLabels.join(", ")
                      : "Inga kluster valda"}
                  </p>
                  <p>Datum: {selectedDate || "Ej valt"}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={clearDisplayedLines}
                disabled={
                  loadingLines || (!hasLoadedLines && lineCards.length === 0)
                }
                className="bg-transparent border border-[var(--border-primary)] text-[var(--text-primary)] text-xs px-3 py-1 rounded hover:bg-[var(--bg)] disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Rensa visning
              </button>
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {isPopupOpen && selectedEquipage && (
        // Modal for consignment-level details on the selected equipage.
        <div className="fixed inset-0 z-[120] bg-black/45 flex items-center justify-center p-4">
          <div className="bg-[var(--primary-element)] rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
              <h2 className="text-[var(--text-primary)] text-xl font-bold">
                Ekipage {selectedEquipage.name} - {selectedEquipage.lineName}
              </h2>
              <button
                onClick={closePopup}
                className="bg-[var(--primary-button)] text-[var(--text-primary)] px-3 py-1 rounded hover:bg-[var(--primary-button-hover)] transition"
              >
                Stäng
              </button>
            </div>

            <div className="p-6 overflow-auto max-h-[calc(90vh-74px)]">
              <div className="mb-4 text-sm text-[var(--text-primary)]">
                <p>
                  <strong>Antal bokningar:</strong>{" "}
                  {selectedEquipage.consignments.length}
                </p>
                <p>
                  <strong>Total vikt:</strong>{" "}
                  {selectedEquipage.totalWeightKg.toFixed(0)} kg
                </p>
                <p>
                  <strong>Total FLM:</strong>{" "}
                  {(selectedEquipage.totalFlm ?? 0).toFixed(1)} flm
                </p>
                <p>
                  <strong>Prognos (total):</strong>{" "}
                  {selectedEquipage.profitabilityStatus === "done"
                    ? `${selectedEquipage.totalProfitabilityPrice.toFixed(0)} kr`
                    : selectedEquipage.profitabilityStatus === "error"
                      ? "Kunde inte beräkna"
                      : "Beräknar..."}
                </p>
              </div>

              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-[var(--border-primary)]">
                    <th className="text-left py-2 pr-3">Destination</th>
                    <th className="text-left py-2 pr-3">Kund</th>
                    <th className="text-left py-2 pr-3">Hämtadress</th>
                    <th className="text-left py-2 pr-3">Hämtort</th>
                    <th className="text-left py-2 pr-3">Godsuppgifter</th>
                    <th className="text-left py-2 pr-3">Prognos</th>
                    <th className="text-left py-2 pr-3">Steg</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedEquipage.consignments.map((consignment, index) => (
                    <tr
                      key={`${consignment.consignmentId}-${index}`}
                      className="border-b border-[var(--border-primary)]"
                    >
                      <td className="py-2 pr-3">
                        {consignment.destinationCity ||
                          consignment.receiverName ||
                          "-"}
                      </td>
                      <td className="py-2 pr-3">
                        {getDisplayCustomerName(consignment)}
                      </td>
                      <td className="py-2 pr-3">
                        {consignment.pickupLocationStreet ||
                          consignment.senderName ||
                          "-"}
                      </td>
                      <td className="py-2 pr-3">
                        {consignment.pickupLocationCity || "-"}
                      </td>
                      <td className="py-2 pr-3">
                        {consignment.estimatedProperties || "-"}
                      </td>
                      <td className="py-2 pr-3">
                        {consignment.profitabilityValue
                          ? consignment.profitabilityValue.step_used === -1
                            ? consignment.profitabilityValue.detail || "-"
                            : `${consignment.profitabilityValue.estimated_revenue.toFixed(0)} kr`
                          : "-"}
                      </td>
                      <td className="py-2 pr-3">
                        {consignment.profitabilityValue
                          ? consignment.profitabilityValue.step_used === -1
                            ? "-"
                            : `${consignment.profitabilityValue.step_used}`
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
