"use client";

import { useEffect } from "react";
import {
  getDefaultHomeDate,
  HOME_CACHE_KEY,
  HomeCachePayload,
  LineWithEquipages,
  normalizeLineCards,
  VehicleSelectorMode,
} from "./homeTypesAndUtils";

/** Persists current Home payload in sessionStorage. */
export function persistHomeCache(payload: HomeCachePayload): void {
  try {
    sessionStorage.setItem(HOME_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
}

/** Clears the persisted Home payload from sessionStorage. */
export function clearHomeCache(): void {
  try {
    sessionStorage.removeItem(HOME_CACHE_KEY);
  } catch {
    // ignore storage errors
  }
}

function sameIdSelection(left: number[], right: number[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const leftSorted = [...left].sort((a, b) => a - b);
  const rightSorted = [...right].sort((a, b) => a - b);
  return leftSorted.every((value, index) => value === rightSorted[index]);
}

function sameStringSelection(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const leftSorted = [...left].sort((a, b) => a.localeCompare(b, "sv"));
  const rightSorted = [...right].sort((a, b) => a.localeCompare(b, "sv"));
  return leftSorted.every((value, index) => value === rightSorted[index]);
}

type UseHomeCacheRestoreParams = {
  areasLoaded: boolean;
  vehicleSelectorMode: VehicleSelectorMode;
  selectedEquipageIds: number[];
  selectedLineIds: number[];
  selectedAreaLabels: string[];
  setSelectedDate: (value: string) => void;
  setLineCards: (value: LineWithEquipages[]) => void;
  setHasLoadedLines: (value: boolean) => void;
  setCandidateEquipageCount: (value: number) => void;
  setVisibleEquipageCount: (value: number) => void;
  setAppliedFilterLabels: (value: string[]) => void;
  setLoadingProfitabilityCount: (value: number) => void;
};

export function useHomeCacheRestore({
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
}: UseHomeCacheRestoreParams): void {
  useEffect(() => {
    if (!areasLoaded) {
      return;
    }

    try {
      const raw = sessionStorage.getItem(HOME_CACHE_KEY);
      if (!raw) {
        return;
      }

      const cached = JSON.parse(raw) as HomeCachePayload;
      if (!cached || !Array.isArray(cached.lineCards)) {
        return;
      }

      if (
        cached.vehicleSelectorMode !== vehicleSelectorMode ||
        !sameIdSelection(cached.selectedEquipageIds ?? [], selectedEquipageIds) ||
        !sameIdSelection(cached.selectedLineIds ?? [], selectedLineIds) ||
        !sameStringSelection(cached.selectedAreaLabels ?? [], selectedAreaLabels)
      ) {
        return;
      }

      // Rebuild derived totals from consignments so stale cached totals do not leak into UI.
      const normalizedLineCards = normalizeLineCards(cached.lineCards);
      const remainingProfitabilityCount = normalizedLineCards.reduce(
        (sum, line) =>
          sum +
          line.equipages.filter(
            (equipage) => equipage.profitabilityStatus === "loading",
          ).length,
        0,
      );

      setSelectedDate(cached.selectedDate || getDefaultHomeDate());
      setLineCards(normalizedLineCards);
      setHasLoadedLines(true);
      setCandidateEquipageCount(cached.candidateEquipageCount ?? 0);
      setVisibleEquipageCount(cached.visibleEquipageCount ?? 0);
      setAppliedFilterLabels(cached.appliedFilterLabels ?? []);
      setLoadingProfitabilityCount(remainingProfitabilityCount);
    } catch {
      // ignore malformed cache
    }
  }, [
    areasLoaded,
    vehicleSelectorMode,
    selectedEquipageIds,
    selectedLineIds,
    selectedAreaLabels,
    setAppliedFilterLabels,
    setCandidateEquipageCount,
    setHasLoadedLines,
    setLineCards,
    setLoadingProfitabilityCount,
    setSelectedDate,
    setVisibleEquipageCount,
  ]);
}
