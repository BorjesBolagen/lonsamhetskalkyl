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
  DEFAULT_PROFITABILITY_REFERENCE_VALUE,
  getDefaultHomeDate,
  parseProfitabilityReferenceValue,
} from "./homeTypesAndUtils";

/**
 * Loads and exposes Home preferences (date, selected area labels, profitability reference).
 */
export function useHomePreferences() {
  const [selectedAreas, setSelectedAreas] = useState<AreaState>(DEFAULT_AREAS);
  const [areasLoaded, setAreasLoaded] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getDefaultHomeDate);
  const [profitabilityReferenceValue, setProfitabilityReferenceValue] =
    useState<number>(DEFAULT_PROFITABILITY_REFERENCE_VALUE);

  const selectedAreaLabels = useMemo(
    () =>
      // Convert boolean area map into the label list used by filtering logic.
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
          setSelectedAreas(parseAreaState(user.filters));
          setProfitabilityReferenceValue(
            parseProfitabilityReferenceValue(user.filters),
          );
        } else {
          setSelectedAreas(DEFAULT_AREAS);
          setProfitabilityReferenceValue(DEFAULT_PROFITABILITY_REFERENCE_VALUE);
        }
      } catch {
        setSelectedAreas(DEFAULT_AREAS);
        setProfitabilityReferenceValue(DEFAULT_PROFITABILITY_REFERENCE_VALUE);
      } finally {
        setAreasLoaded(true);
      }
    }

    void loadCurrentUserSettings();
  }, []);

  return {
    selectedAreaLabels,
    selectedDate,
    setSelectedDate,
    profitabilityReferenceValue,
    areasLoaded,
  };
}
