"use client";

import { useState } from "react";
import { normalizeLineName } from "../../../lib/areaLineConfig";
import { persistHomeCache } from "./useHomeCache";
import {
  ensureEquipageTotals,
  EquipageWithConsignments,
  LineWithEquipages,
  VehicleSelectorMode,
} from "./homeTypesAndUtils";

type UseHomeLineStateParams = {
  selectedDate: string;
  vehicleSelectorMode: VehicleSelectorMode;
  selectedEquipageIds: number[];
  selectedLineIds: number[];
  selectedAreaLabels: string[];
  appliedFilterLabels: string[];
};

/**
 * Owns line/equipage UI state and controlled state mutations for Home.
 */
export function useHomeLineState({
  selectedDate,
  vehicleSelectorMode,
  selectedEquipageIds,
  selectedLineIds,
  selectedAreaLabels,
  appliedFilterLabels,
}: UseHomeLineStateParams) {
  const [lineCards, setLineCards] = useState<LineWithEquipages[]>([]);
  const [candidateEquipageCount, setCandidateEquipageCount] = useState(0);
  const [visibleEquipageCount, setVisibleEquipageCount] = useState(0);
  const [selectedEquipage, setSelectedEquipage] =
    useState<EquipageWithConsignments | null>(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  /** Persists the current card state, including derived visible count. */
  function persistCurrentHomeCache(nextLineCards: LineWithEquipages[]): void {
    const nextVisibleEquipageCount = nextLineCards.reduce(
      (sum, line) => sum + line.equipages.length,
      0,
    );

    persistHomeCache({
      selectedDate,
      lineCards: nextLineCards,
      candidateEquipageCount,
      visibleEquipageCount: nextVisibleEquipageCount,
      vehicleSelectorMode,
      selectedEquipageIds,
      selectedLineIds,
      selectedAreaLabels,
      appliedFilterLabels,
    });
  }

  /** Clears only visible results while keeping user preferences intact. */
  function resetDisplayedData(): void {
    setLineCards([]);
    setCandidateEquipageCount(0);
    setVisibleEquipageCount(0);
    setSelectedEquipage(null);
    setIsPopupOpen(false);
  }

  /**
   * Applies an update to one equipage consistently in both line list and open popup state.
   */
  function updateEquipageInState(
    equipageId: number,
    updater: (equipage: EquipageWithConsignments) => EquipageWithConsignments,
  ): void {
    setLineCards((currentLines) => {
      let changed = false;

      const nextLines = currentLines.map((line) => {
        let lineChanged = false;

        const nextEquipages = line.equipages.map((equipage) => {
          if (equipage.id !== equipageId) {
            return equipage;
          }

          changed = true;
          lineChanged = true;
          return ensureEquipageTotals(updater(equipage));
        });

        return lineChanged ? { ...line, equipages: nextEquipages } : line;
      });

      if (changed) {
        persistCurrentHomeCache(nextLines);
      }

      return changed ? nextLines : currentLines;
    });

    setSelectedEquipage((current) => {
      if (!current || current.id !== equipageId) {
        return current;
      }

      // Keep popup details in sync when the updated equipage is currently selected.
      return ensureEquipageTotals(updater(current));
    });
  }

  /**
   * Merges a fetched batch into existing line cards while deduplicating by line+equipage identity.
   */
  function mergeLineBatchIntoState(batchLines: LineWithEquipages[]): void {
    setLineCards((currentLines) => {
      const lineMap = new Map<string, LineWithEquipages>();

      for (const line of currentLines) {
        const key = `${line.id}|${normalizeLineName(line.name)}`;
        lineMap.set(key, {
          ...line,
          equipages: [...line.equipages],
        });
      }

      for (const line of batchLines) {
        const key = `${line.id}|${normalizeLineName(line.name)}`;
        const existingLine = lineMap.get(key);

        if (!existingLine) {
          lineMap.set(key, {
            ...line,
            equipages: [...line.equipages].sort((a, b) =>
              a.name.localeCompare(b.name, "sv"),
            ),
          });
          continue;
        }

        const equipageMap = new Map<number, EquipageWithConsignments>();
        for (const equipage of existingLine.equipages) {
          equipageMap.set(equipage.id, equipage);
        }

        for (const equipage of line.equipages) {
          equipageMap.set(equipage.id, equipage);
        }

        existingLine.equipages = Array.from(equipageMap.values()).sort((a, b) =>
          a.name.localeCompare(b.name, "sv"),
        );
      }

      const nextLines = Array.from(lineMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name, "sv"),
      );

      persistCurrentHomeCache(nextLines);
      return nextLines;
    });
  }

  return {
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
  };
}
