export const AREA_OPTIONS = {
  linkoping: "Linköping",
  vaxjo: "Växjö",
  sundsvall: "Sundsvall",
  jonkoping: "Jönköping",
  stockholm: "Stockholm",
  goteborg: "Göteborg",
  malmo: "Malmö",
  nybro: "Nybro",
} as const;

export type AreaKey = keyof typeof AREA_OPTIONS;
export type AreaState = Record<AreaKey, boolean>;

export const AREA_KEYS = Object.keys(AREA_OPTIONS) as AreaKey[];

export const DEFAULT_AREAS: AreaState = {
  linkoping: false,
  vaxjo: false,
  sundsvall: false,
  jonkoping: false,
  stockholm: false,
  goteborg: false,
  malmo: false,
  nybro: false,
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseAreaState(filters: unknown): AreaState {
  const source =
    isPlainObject(filters) && isPlainObject(filters.areas)
      ? filters.areas
      : isPlainObject(filters)
        ? filters
        : null;

  if (!source) {
    return DEFAULT_AREAS;
  }

  return {
    linkoping: source.linkoping === true,
    vaxjo: source.vaxjo === true,
    sundsvall: source.sundsvall === true,
    jonkoping: source.jonkoping === true,
    stockholm: source.stockholm === true,
    goteborg: source.goteborg === true,
    malmo: source.malmo === true,
    nybro: source.nybro === true,
  };
}
