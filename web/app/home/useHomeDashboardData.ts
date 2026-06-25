"use client";

import { useRef, useState } from "react";
import { useHomeCacheRestore } from "./hooks/useHomeCache";
import { useHomeLineState } from "./hooks/useHomeLineState";
import { useHomeLoader } from "./hooks/useHomeLoader";
import { useHomePreferences } from "./hooks/useHomePreferences";
import { useHomeProfitability } from "./hooks/useHomeProfitability";
import {
  ensureEquipageTotals,
  EquipageWithConsignments,
} from "./hooks/homeTypesAndUtils";

export { getDisplayCustomerName } from "./hooks/homeTypesAndUtils";

/**
 * Composes Home-specific hooks into one stable API for the Home page.
 */
export function useHomeDashboardData() {
  // Keeps the labels that were used in the latest successful fetch.
  const [appliedFilterLabels, setAppliedFilterLabels] = useState<string[]>([]);
  // Guards async updates so stale loads cannot overwrite newer state.
  const latestLoadIdRef = useRef(0);

  const {
    vehicleSelectorMode,
    selectedEquipageIds,
    selectedLineIds,
    selectedAreaLabels,
    selectedDate,
    setSelectedDate,
    profitabilityReferenceValue,
    areasLoaded,
  } = useHomePreferences();

  const {
    lineCards,
    setLineCards,
    candidateEquipageCount,
    setCandidateEquipageCount,
    visibleEquipageCount,
    setVisibleEquipageCount,
    selectedEquipage,
    setSelectedEquipage,
    isPopupOpen,
    setIsPopupOpen,
    resetDisplayedData,
    updateEquipageInState,
    mergeLineBatchIntoState,
  } = useHomeLineState({
    selectedDate,
    vehicleSelectorMode,
    selectedEquipageIds,
    selectedLineIds,
    selectedAreaLabels,
    appliedFilterLabels,
  });

  const {
    loadingProfitabilityCount,
    setLoadingProfitabilityCount,
    hydrateProfitabilityForEquipages,
  } = useHomeProfitability({
    latestLoadIdRef,
    profitabilityReferenceValue,
    updateEquipageInState,
  });

  const {
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
  } = useHomeLoader({
    selectedDate,
    vehicleSelectorMode,
    selectedEquipageIds,
    selectedLineIds,
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
    setAppliedFilterLabels,
  });

  useHomeCacheRestore({
    areasLoaded,
    vehicleSelectorMode,
    selectedEquipageIds,
    selectedLineIds,
    selectedAreaLabels,
    setSelectedDate,
    setLineCards,
    setHasLoadedLines,
    setCandidateEquipageCount,
    setVisibleEquipageCount,
    setAppliedFilterLabels,
    setLoadingProfitabilityCount,
  });

  /** Opens details modal and ensures totals are up to date before rendering. */
  const openPopup = (equipage: EquipageWithConsignments) => {
    setSelectedEquipage(ensureEquipageTotals(equipage));
    setIsPopupOpen(true);
  };

  /** Closes the currently open details modal. */
  const closePopup = () => setIsPopupOpen(false);

  return {
    vehicleSelectorMode,
    selectedDate,
    setSelectedDate,
    profitabilityReferenceValue,
    lineCards,
    loadingLines,
    loadingProfitabilityCount,
    lineError,
    hasLoadedLines,
    candidateEquipageCount,
    visibleEquipageCount,
    appliedFilterLabels,
    selectedEquipageIds,
    selectedLineIds,
    selectedAreaLabels,
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
  };
}
