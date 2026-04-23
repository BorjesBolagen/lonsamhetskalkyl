"use client";

import { useEffect } from "react";
import {
  getDefaultHomeDate,
  HOME_CACHE_KEY,
  HomeCachePayload,
  LineWithEquipages,
  normalizeLineCards,
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

type UseHomeCacheRestoreParams = {
  areasLoaded: boolean;
  setSelectedDate: (value: string) => void;
  setLineCards: (value: LineWithEquipages[]) => void;
  setHasLoadedLines: (value: boolean) => void;
  setCandidateEquipageCount: (value: number) => void;
  setVisibleEquipageCount: (value: number) => void;
  setAppliedClusterLabels: (value: string[]) => void;
  setLoadingProfitabilityCount: (value: number) => void;
};

export function useHomeCacheRestore({
  areasLoaded,
  setSelectedDate,
  setLineCards,
  setHasLoadedLines,
  setCandidateEquipageCount,
  setVisibleEquipageCount,
  setAppliedClusterLabels,
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
      setAppliedClusterLabels(cached.appliedClusterLabels ?? []);
      setLoadingProfitabilityCount(remainingProfitabilityCount);
    } catch {
      // ignore malformed cache
    }
  }, [
    areasLoaded,
    setAppliedClusterLabels,
    setCandidateEquipageCount,
    setHasLoadedLines,
    setLineCards,
    setLoadingProfitabilityCount,
    setSelectedDate,
    setVisibleEquipageCount,
  ]);
}
