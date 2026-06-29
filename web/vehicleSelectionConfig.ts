export type VehicleSelectorMode = "equipages" | "lines";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePositiveIntegerList(raw: unknown): number[] {
  if (Array.isArray(raw)) {
    return Array.from(
      new Set(
        raw
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value > 0),
      ),
    );
  }

  if (isPlainObject(raw)) {
    return Object.entries(raw)
      .filter(([, isActive]) => isActive === true)
      .map(([id]) => Number(id))
      .filter((value) => Number.isInteger(value) && value > 0);
  }

  return [];
}

export function parseSelectedEquipageIds(filters: unknown): number[] {
  if (!isPlainObject(filters)) {
    return [];
  }

  return parsePositiveIntegerList(filters.equipages);
}

export function parseSelectedLineIds(filters: unknown): number[] {
  if (!isPlainObject(filters)) {
    return [];
  }

  return parsePositiveIntegerList(filters.lines);
}

export function parseVehicleSelectorMode(filters: unknown): VehicleSelectorMode {
  if (
    isPlainObject(filters) &&
    (filters.vehicleSelectorMode === "equipages" ||
      filters.vehicleSelectorMode === "lines")
  ) {
    return filters.vehicleSelectorMode;
  }

  return "equipages";
}
