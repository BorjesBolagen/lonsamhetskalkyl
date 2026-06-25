"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AREA_OPTIONS,
  AreaKey,
  AreaState,
  DEFAULT_AREAS,
  parseAreaState,
} from "../../../lib/areaLineConfig";
import { getCurrentlySignedInUser } from "../../../lib/api";
import {
  parseSelectedEquipageIds,
  parseSelectedLineIds,
  parseVehicleSelectorMode,
  VehicleSelectorMode,
} from "../../../vehicleSelectionConfig";
import {
  DEFAULT_PROFITABILITY_REFERENCE_VALUE,
  getDefaultHomeDate,
  parseProfitabilityReferenceValue,
} from "./homeTypesAndUtils";

/**
 * Loads and exposes Home preferences (date, selected transport filter, profitability reference).
 */
export function useHomePreferences() {
  const [vehicleSelectorMode, setVehicleSelectorMode] =
    useState<VehicleSelectorMode>("equipages");
  const [selectedEquipageIds, setSelectedEquipageIds] = useState<number[]>([]);
  const [selectedLineIds, setSelectedLineIds] = useState<number[]>([]);
  const [selectedAreas, setSelectedAreas] = useState<AreaState>(DEFAULT_AREAS);
  const [areasLoaded, setAreasLoaded] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getDefaultHomeDate);
  const [profitabilityReferenceValue, setProfitabilityReferenceValue] =
    useState<number>(DEFAULT_PROFITABILITY_REFERENCE_VALUE);

  const selectedAreaLabels = useMemo(
    () =>
      // Legacy fallback for users that still only have old cluster selections saved.
      Object.entries(selectedAreas)
        .filter(([, isActive]) => isActive)
        .map(([areaKey]) => AREA_OPTIONS[areaKey as AreaKey]),
    [selectedAreas],
  );

  useEffect(() => {
    /** Restores persisted user filter preferences once when Home mounts. */
    async function loadCurrentUserSettings() {
      try {
        const response = await getCurrentlySignedInUser();
        const user = response.data;

        if (user) {
          setVehicleSelectorMode(parseVehicleSelectorMode(user.filters));
          setSelectedEquipageIds(parseSelectedEquipageIds(user.filters));
          setSelectedLineIds(parseSelectedLineIds(user.filters));
          setSelectedAreas(parseAreaState(user.filters));
          setProfitabilityReferenceValue(
            parseProfitabilityReferenceValue(user.filters),
          );
        } else {
          setVehicleSelectorMode("equipages");
          setSelectedEquipageIds([]);
          setSelectedLineIds([]);
          setSelectedAreas(DEFAULT_AREAS);
          setProfitabilityReferenceValue(DEFAULT_PROFITABILITY_REFERENCE_VALUE);
        }
      } catch {
        setVehicleSelectorMode("equipages");
        setSelectedEquipageIds([]);
        setSelectedLineIds([]);
        setSelectedAreas(DEFAULT_AREAS);
        setProfitabilityReferenceValue(DEFAULT_PROFITABILITY_REFERENCE_VALUE);
      } finally {
        setAreasLoaded(true);
      }
    }

    void loadCurrentUserSettings();
  }, []);

  return {
    vehicleSelectorMode,
    selectedEquipageIds,
    selectedLineIds,
    selectedAreaLabels,
    selectedDate,
    setSelectedDate,
    profitabilityReferenceValue,
    areasLoaded,
  };
}
