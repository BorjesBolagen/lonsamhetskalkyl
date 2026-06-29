"use client";

import Navigation from "../../components/Navigation";
import Footer from "../../components/Footer";
import LineCard from "../../components/LineCard";
import EquipageCard from "../../components/EquipageCard";
import { NameDropdown, type NameSource } from "../../components/Dropdown";
import PriceWithAddons from "../../components/PriceWithAddons";
import { useHomeDashboardData } from "./useHomeDashboardData";
import { InfoTooltip } from "@/components/InformationBubble";
import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  calculateConsignmentProfitabilityPrice,
  ConsignmentWithProfitability,
  EquipageWithConsignments,
  toBarPercent,
} from "./hooks/homeTypesAndUtils";

const STANDARD_FLM = 19.2;

type TruckLineTooltipProps = {
  text: string;
};

function TruckLineTooltip({ text }: TruckLineTooltipProps) {
  const iconRef = useRef<HTMLSpanElement | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{
    top: number;
    left: number;
    width: number;
    placement: "top" | "bottom";
  } | null>(null);

  const showTooltip = () => {
    const icon = iconRef.current;
    if (!icon) return;

    const rect = icon.getBoundingClientRect();
    const margin = 8;
    const preferredWidth = 280;
    const width = Math.min(preferredWidth, window.innerWidth - margin * 2);
    const estimatedHeight = 72;

    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(margin, left);
    left = Math.min(window.innerWidth - width - margin, left);

    const spaceAbove = rect.top - margin;
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const placement: "top" | "bottom" =
      spaceBelow >= estimatedHeight || spaceBelow >= spaceAbove
        ? "bottom"
        : "top";

    const top =
      placement === "bottom"
        ? Math.min(rect.bottom + 10, window.innerHeight - estimatedHeight - margin)
        : Math.max(margin, rect.top - estimatedHeight - 10);

    setTooltipPosition({
      top,
      left,
      width,
      placement,
    });
  };

  const hideTooltip = () => {
    setTooltipPosition(null);
  };

  return (
    <>
      <span
        ref={iconRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        tabIndex={0}
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[var(--text-primary)] text-[10px] font-bold leading-none cursor-help outline-none focus:ring-2 focus:ring-black/30"
        aria-label={text}
      >
        i
      </span>

      {tooltipPosition &&
        createPortal(
          <div
            className="fixed pointer-events-none rounded-md border border-black bg-white px-3 py-2 text-xs font-normal leading-snug text-black shadow-lg max-h-[40vh] overflow-auto"
            style={{
              top: tooltipPosition.top,
              left: tooltipPosition.left,
              width: tooltipPosition.width,
              zIndex: 2147483647,
            }}
          >
            {text}
            <span
              className={
                tooltipPosition.placement === "bottom"
                  ? "absolute left-1/2 bottom-full h-2 w-2 -translate-x-1/2 translate-y-1/2 rotate-45 border-l border-t border-black bg-white"
                  : "absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-black bg-white"
              }
            />
          </div>,
          document.body,
        )}
    </>
  );
}


export default function Home() {
  /**
   * Home is the presentation layer: it renders cards/popup and delegates data logic to useHomeDashboardData.
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
    appliedFilterLabels,
    vehicleSelectorMode,
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
    updateEquipageInState,
  } = useHomeDashboardData();

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

  const [loadingRows, setLoadingRows] = useState<Record<string, boolean>>({});

  const equipageCards = useMemo(
    () =>
      lineCards
        .flatMap((line) => line.equipages)
        .sort((a, b) => a.name.localeCompare(b.name, "sv")),
    [lineCards],
  );

  /**
   * Handles when you select a name from the dropdown
   */
  const handleNameSelect = async (
    consignment: ConsignmentWithProfitability,
    chosenName: string,
    source: NameSource
  ) => {
    const id = consignment.consignmentId;
    setLoadingRows(prev => ({ ...prev, [id]: true }));
    try {
      // Use the entire name for translation and jaro sources, but not for base
      const useEntireName = source === "translation" || source === "jaro";
      const profitabilityValue = await calculateConsignmentProfitabilityPrice({
          ...consignment,
          customerName: chosenName,
        },
        useEntireName
      );
      updateEquipageInState(selectedEquipage!.id, (current) => {
        const updatedConsignments = current.consignments.map(c => {
          if (c.consignmentId !== id) return c;
          return {
            ...c,
            profitabilityValue: profitabilityValue,
            selectedNameForProfitability: chosenName,
            selectedNameSource: source,
          };
        });
        const totalProfitabilityPrice = updatedConsignments.reduce(
          (sum, c) => sum + (c.profitabilityValue?.estimated_revenue ?? 0), 0
        );
        return {
          ...current,
          consignments: updatedConsignments,
          totalProfitabilityPrice,
          profitabilityBarPercent: toBarPercent(totalProfitabilityPrice, profitabilityReferenceValue),
        };
      });
    } catch (e) {
      console.error("Kunde inte beräkna lönsamhet:", e);
    } finally {
      setLoadingRows(prev => ({ ...prev, [id]: false }));
    }
  };

  const renderEquipageCard = (
    equipage: EquipageWithConsignments,
    keyPrefix: string,
  ) => {
    const isProfitabilityLoading =
      equipage.profitabilityStatus === "idle" ||
      equipage.profitabilityStatus === "loading";

    return (
      <EquipageCard
        key={`${keyPrefix}-${equipage.id}`}
        title={equipage.name}
        titleAddon={
          vehicleSelectorMode === "equipages" ? (
            <TruckLineTooltip text={`Linje: ${equipage.lineName || "-"}`} />
          ) : undefined
        }
        capacity={convertFlmToBarProgress(equipage.totalFlm)}
        price={convertProfitToBarProgress(equipage.totalProfitabilityPrice)}
        priceLoading={isProfitabilityLoading}
        onRefresh={() => refreshEquipageConsignments(equipage.id)}
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
  };

  const modeLabel = vehicleSelectorMode === "equipages" ? "lastbilar" : "linjer";
  const lineLabel = lineCards.length === 1 ? "linje" : "linjer";
  const equipageLabel = visibleEquipageCount === 1 ? "ekipage" : "ekipage";
  const truckLabel = visibleEquipageCount === 1 ? "lastbil" : "lastbilar";
  
  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <Navigation currentPage="home" />

      <main className="flex-grow p-6 flex gap-6">
        <div className="w-full flex-grow max-w-[90rem]"> 
          {/* Left column: selected truck cards or original line grouping depending on saved mode. */}
          {!lineError && lineCards.length > 0 && vehicleSelectorMode === "equipages" && (
            <div className="flex flex-wrap gap-4 items-start w-full">
              {equipageCards.map((equipage) =>
                renderEquipageCard(equipage, `equipage-${equipage.lineId}`),
              )}
            </div>
          )}

          {!lineError && lineCards.length > 0 && vehicleSelectorMode === "lines" && (
            <div className="columns-1 2xl:columns-2 gap-6">
              {lineCards.map((line) => (
                <div
                  key={`${line.id}-${line.name}`}
                  className="break-inside-avoid mb-6 inline-block w-full"
                >
                  <LineCard
                    title={`${line.name} (${line.id})`}
                    onRefresh={() => refreshLineConsignments(line.id)}
                    isRefreshing={refreshingLines.has(line.id)}
                  >
                    <div className="flex flex-wrap gap-4 items-start w-full">
                      {line.equipages.map((equipage) =>
                        renderEquipageCard(equipage, `line-${line.id}`),
                      )}
                    </div>
                  </LineCard>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="w-[25rem] space-y-6 ml-auto">
          {/* Right column: controls + status summary for current fetch context. */}
          <div className="bg-[var(--primary-element)] rounded-xl shadow-md p-6 w-full max-w-none space-y-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                Aktuella {modeLabel}
              </p>
              {!areasLoaded && (
                <p className="text-sm text-[var(--text-primary)] mt-1">
                  Laddar dina sparade val...
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
                    ? "Hämtar valda bokningar..."
                    : `Hämta valda ${modeLabel}`}
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
                  Klicka på knappen för att ladda valda bokningar.
                </p>
              ) : lineCards.length > 0 ? (
                <div className="text-[var(--text-primary)] space-y-1 leading-6">
                  <p>
                    Hittade{" "}
                    {vehicleSelectorMode === "equipages"
                      ? `${visibleEquipageCount} ${truckLabel}`
                      : `${lineCards.length} ${lineLabel} med totalt ${visibleEquipageCount} ${equipageLabel}`}
                    .
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
                  <p>Inga bokningar hittades för dina val.</p>
                  <p>
                    Val: {appliedFilterLabels.length > 0
                      ? appliedFilterLabels.join(", ")
                      : `Inga ${modeLabel} valda`}
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
                className="bg-[var(--primary-button)] text-[var(--text-primary)] px-3 py-1 rounded cursor-pointer hover:bg-[var(--button-reset-hover)] transition"
              >
                Stäng
              </button>
            </div>

            <div className="p-6 overflow-auto max-h-[calc(90vh-74px)]">
              <div className="mb-4 grid grid-cols-5 gap-3">
                {[
                  { icon: "ti-route", label: "Linje", value: selectedEquipage.lineName || "-", color: "bg-blue-500/10 text-blue-500" },
                  { icon: "ti-package", label: "Antal bokningar", value: `${selectedEquipage.consignments.length}`, color: "bg-blue-500/10 text-blue-500" },
                  { icon: "ti-weight", label: "Total vikt", value: `${selectedEquipage.totalWeightKg.toFixed(0)} kg`, color: "bg-amber-500/10 text-amber-500" },
                  { icon: "ti-truck", label: "Total FLM", value: `${(selectedEquipage.totalFlm ?? 0).toFixed(1)} flm`, color: "bg-green-500/10 text-green-500" },
                  {
                    icon: "ti-cash",
                    label: "Prognos (total)",
                    value: selectedEquipage.profitabilityStatus === "done"
                      ? `${selectedEquipage.totalProfitabilityPrice.toFixed(0)} kr`
                      : selectedEquipage.profitabilityStatus === "error"
                      ? "Kunde inte beräkna"
                      : "Beräknar...",
                    color: "bg-green-500/10 text-green-500"
                  },
                ].map(({ icon, label, value, color }) => (
                  <div key={label} className="bg-[var(--secondary-element)] rounded-lg p-4 flex flex-col gap-2">
                    <div className={`w-9 h-9 rounded-md flex items-center justify-center ${color}`}>
                      <i className={`ti ${icon} text-lg`} />
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">{label}</p>
                    <p className="text-xl font-medium text-[var(--text-primary)]">{value}</p>
                  </div>
                ))}
              </div>

              <table className="w-full text-sm text-[var(--text-secondary)] border-collapse" >
                <thead>
                  <tr className="border-b-2 border-[var(--border-primary)] dark:border-gray-600">
                    <th className="text-left py-2 pr-3">Destination</th>
                    <th className="text-left py-2 pr-3">Kundnamn</th>
                    <th className="text-left py-2 pr-3">Hämtadress</th>
                    <th className="text-left py-2 pr-3">Hämtort</th>
                    <th className="text-left py-2 pr-3">Godsuppgifter</th>
                    <th className="text-left py-2 pr-3">Prognos</th>
                    <th className="text-left py-2 pr-3">
                      <span className="flex items-center gap-1">
                        Steg
                        <InfoTooltip text={"Ett lägre steg innebär en bättre prognos."} align="right" />
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selectedEquipage.consignments.map((consignment, index) => (
                    <tr
                      key={`${consignment.consignmentId}-${index}`}
                      className="border-b border-[var(--border-primary)] dark:border-gray-600"
                    >
                      <td className="py-2 pr-3">
                        {consignment.destinationCity ||
                          consignment.receiverName ||
                          "-"}
                      </td>
                      <td className="py-2 pr-3">
                        <NameDropdown
                          consignment={consignment}
                          onSelect={(name, source) => handleNameSelect(consignment, name, source)}
                          loading={loadingRows[consignment.consignmentId] || false}
                        />
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
                        {loadingRows[consignment.consignmentId] ? (
                          <span className="inline-block animate-spin text-[var(--text-secondary)]">
                            <i className="ti ti-loader-2" aria-hidden="true" />
                          </span>
                        ) : consignment.profitabilityValue ? (
                          consignment.profitabilityValue.step_used === -1 ? (
                            consignment.profitabilityValue.detail || "-"
                          ) : (
                            <PriceWithAddons value={consignment.profitabilityValue} />
                          )
                        ) : (
                          "-"
                        )}
                      </td>

                      <td className="py-2 pr-3">
                        {loadingRows[consignment.consignmentId] ? (
                          <span className="inline-block animate-spin text-[var(--text-secondary)]">
                            <i className="ti ti-loader-2" aria-hidden="true" />
                          </span>
                        ) : (
                          consignment.profitabilityValue
                            ? consignment.profitabilityValue.step_used === 0 
                              // Om step är 0 kollar vi om vilken tabell som används
                              ? consignment.profitabilityValue.detail?.includes("Sune")
                                ? "Sune"
                                : consignment.profitabilityValue.detail?.includes("Paketbur")
                                  ? "Paketbur"
                                  : "Egen"
                              : consignment.profitabilityValue.step_used === -1
                                ? "-"
                                : `${consignment.profitabilityValue.step_used}`
                            : "-"
                        )}
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
