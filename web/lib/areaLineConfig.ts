// Mapping from line labels in iLog/Excel to filter clusters in settings.
const LINE_TO_CLUSTER: Record<string, string> = {
  "Alvesta": "DistributionVXO",
  "Borlänge - GBG": "AHL-Borlänge",
  "Borlänge - Halmstad": "AHL-Borlänge",
  "Borlänge - Helsingborg": "AHL-Borlänge",
  "Borlänge - Kristianstad": "AHL-Borlänge",
  "Borlänge - Malmö": "AHL-Borlänge",
  "Borlänge - Nybro": "SML-Borlänge",
  "Borlänge - Vänersborg": "AHL-Borlänge",
  "Borlänge - Värnamo": "SML-Borlänge",
  "Borlänge - Växjö": "SML-Borlänge",
  "Centrum": "DistributionVXO",
  "GBG - Borlänge": "AHL-Göteborg",
  "GBG-Gävle": "AHL-Göteborg",
  "Gemla": "DistributionVXO",
  "Gävle - Halmstad": "AHL-Gävle",
  "Gävle - Jönköping": "SML-Gävle",
  "Gävle - Kristianstad": "SML-Gävle",
  "Gävle - Nybro": "SML-Gävle",
  "Gävle - Vänersborg": "AHL-Gävle",
  "Gävle - Värnamo": "SML-Gävle",
  "Gävle - Växjö": "SML-Gävle",
  "Gävle-GBG": "AHL-Gävle",
  "Gävle-Helsingborg": "AHL-Gävle",
  "Göteborg - Hudiksvall": "AHL-Göteborg",
  "Göteborg - Sundsvall": "AHL-Göteborg",
  "Halmstad - Borlänge": "AHL-Skåne",
  "Halmstad - Gävle": "AHL-Skåne",
  "Helsingborg - Borlänge": "AHL-Skåne",
  "Helsingborg - Växjö (Avd:1344)": "SML-Skåne",
  "Helsingborg-Gävle": "AHL-Skåne",
  "HUDIKSVALL": "SML-Hudiksvall",
  "Hudiksvall - Göteborg": "AHL-Hudiksvall",
  "Hudiksvall - Hultsfred": "SML-Hudiksvall",
  "Hudiksvall - Jönköping": "SML-Hudiksvall",
  "Hudiksvall - Nybro": "SML-Hudiksvall",
  "Hudiksvall - Värnamo": "SML-Hudiksvall",
  "Hudiksvall - Växjö": "SML-Hudiksvall",
  "Hultsfred - Borlänge": "SML-Hultsfred",
  "Hultsfred - Gävle": "SML-Hultsfred",
  "Hultsfred - Sundsvall": "SML-Hultsfred",
  "Hultsfred - Västerås": "SML-Hultsfred",
  "Hultsfred-Karlstad": "SML-Hultsfred",
  "Hultsfred-Örebro": "SML-Hultsfred",
  "Industri": "DistributionVXO",
  "Ingelstad": "DistributionVXO",
  "JämjöN": "DistributionVXO",
  "Jönköping - Gävle": "SML-Jönköping",
  "Jönköping - Hudiksvall": "SML-Jönköping",
  "Jönköping - Karlstad (Avd:1347)": "SML-Jönköping",
  "Jönköping - Ljungby": "SML-Jönköping",
  "Jönköping - Sundsvall": "SML-Jönköping",
  "Jönköping - Växjö (Avd:1347)": "SML-Jönköping",
  "Karlshamn - Borlänge": "SML-Växjö",
  "Karlshamn - Karlstad": "SML-Växjö",
  "Karlskrona - Västerås": "SML-Växjö",
  "Karlskrona YtterN": "DistributionBLE",
  "Karlstad - Hultsfred": "SML-Växjö",
  "Karlstad - Jönköping (Avd:1347)": "SML-Växjö",
  "Karlstad - Nybro (Avd:1135)": "SML-Växjö",
  "Karlstad - Växjö (Avd:1335)": "SML-Växjö",
  "Kristianstad - Borlänge": "SML-Växjö",
  "Kristianstad - Gävle": "SML-Växjö",
  "Kristianstad-Växjö": "SML-Växjö",
  "Lammhult": "DistributionVXO",
  "Lessebo": "DistributionVXO",
  "Linköping - Ljungby (Avd:1440)": "SML-Linköping",
  "Linköping-Nybro": "SML-Linköping",
  "Ljungby - Linköping": "SML-Växjö",
  "Ljungby - Örebro": "SML-Växjö",
  "Malmö - Borlänge": "AHL-Skåne",
  "Malmö-Växjö (Avd:1343)": "SML-Skåne",
  "Markaryd - Malmö": "AHL-Skåne",
  "Markaryd-Örebro": "SML-Växjö",
  "Nybro - Borlänge": "SML-Nybro",
  "Nybro - Gävle": "SML-Nybro",
  "Nybro - Hudiksvall": "SML-Nybro",
  "Nybro - Karlstad": "SML-Nybro",
  "Nybro - Linköping": "SML-Nybro",
  "Nybro - Stockholm": "SML-Nybro",
  "Nybro - Sundsvall": "SML-Nybro",
  "Nybro - Södertälje (Avd:1125)": "SML-Nybro",
  "Nybro - Västerås": "SML-Nybro",
  "Nybro - Växjö": "SML-Nybro",
  "Nybro - Örebro": "SML-Nybro",
  "Ronneby InnerN": "DistributionBLE",
  "Ronneby YtterN": "DistributionBLE",
  "Släp": "Övrigt",
  "Stockholm - Nybro (Avd:1125)": "SML-Stockholm",
  "Stockholm - Värnamo SML (Avd:1525)": "SML-Stockholm",
  "Stockholm - Växjö (Avd:1325)": "SML-Stockholm",
  "Sundsvall - Göteborg": "AHL-Sundsvall",
  "Sundsvall - Hultsfred": "SML-Sundsvall",
  "Sundsvall - Jönköping": "SML-Sundsvall",
  "Sundsvall - Nybro": "SML-Sundsvall",
  "Sundsvall - Värnamo": "SML-Sundsvall",
  "Sundsvall - Växjö": "SML-Sundsvall",
  "Sunes": "Sunes",
  "Sunes Flisbilar": "Sunes",
  "Sunes Lastväxlare": "Sunes",
  "Södertälje - Nybro (Avd:1125)": "SML-Stockholm",
  "Södertälje - Växjö (Avd:1325)": "SML-Stockholm",
  "Vetlanda - Gävle/Hudik": "SML-Jönköping",
  "Vetlanda-Örebro": "SML-Nybro",
  "Vislanda": "DistributionVXO",
  "Vänersborg - Borlänge": "AHL-Göteborg",
  "Vänersborg - Gävle": "AHL-Göteborg",
  "Vänersborg - Hudiksvall": "AHL-Göteborg",
  "Vänersborg - Sundsvall": "AHL-Göteborg",
  "Värnamo - Gävle": "SML-Värnamo",
  "Värnamo - Hudiksvall": "SML-Värnamo",
  "Värnamo - Stockholm (Avd:1525)": "SML-Värnamo",
  "Värnamo - Stockholm Sävsjö": "SML-Värnamo",
  "Värnamo - Sundsvall": "SML-Värnamo",
  "Värnamo - Västerås": "SML-Värnamo",
  "Värnamo - Växjö": "SML-Värnamo",
  "Värnamo-Borlänge": "SML-Värnamo",
  "Västerås - Hultsfred": "SML-Västerås",
  "Västerås - Nybro (Avd:1120)": "SML-Västerås",
  "Västerås - Värnamo (Avd:1520)": "SML-Västerås",
  "Västerås - Växjö (Avd:1320)": "SML-Västerås",
  "Växjö - Borlänge (Avd:1315)": "SML-Växjö",
  "Växjö - Gävle (Avd:1310)": "SML-Växjö",
  "Växjö - Helsingborg (Avd:1344)": "SML-Växjö",
  "Växjö - Hudiksvall": "SML-Växjö",
  "Växjö - Jönköping (Avd:1347)": "SML-Växjö",
  "Växjö - Karlstad (Avd:1335)": "SML-Växjö",
  "Växjö - Kristianstad (Avd:1345)": "SML-Växjö",
  "Växjö - Malmö (Avd:1343)": "SML-Växjö",
  "Växjö - Nybro (Avd:1390)": "SML-Växjö",
  "Växjö - Stockholm (Avd:1325)": "SML-Växjö",
  "Växjö - Sundsvall": "SML-Växjö",
  "Växjö - Södertälje (Avd:1325)": "SML-Växjö",
  "Växjö - Värnamo (Avd:1390)": "SML-Växjö",
  "Växjö - Västerås (Avd:1320)": "SML-Växjö",
  "Växjö - Örebro (Avd:1330)": "SML-Växjö",
  "Ytter": "DistributionVXO",
  "Älmhult": "DistributionVXO",
  "Örebro - Hultsfred": "SML-Örebro",
  "Örebro - Nybro": "SML-Örebro",
  "Örebro - Växjö": "SML-Örebro",
  "Örkeljunga IN": "AHL-Distribution",
  "Örkeljunga UT": "AHL-Distribution",
  "Övrigt": "Övrigt", // Allt nedan är nya uppdaterade linjer
  "Blekinge - Örebro": "SML-Nybro",
  "Bollnäs - Göteborg": "AHL-Gävle",
  "Bollnäs Söderhamn-GBG": "SML-Gävle",
  "Bollnäs-Malmö": "AHL-Gävle",
  "Borgholm": "SML-Nybro",
  "Borlänge - Gävle": "SML-Borlänge",
  "Borås - Hudiksvall": "AHL-Göteborg",
  "Borås - Sundsvall": "AHL-Göteborg",
  "C/S Borlänge - Kristianstad": "SML-Borlänge",
  "C/S kristianstad - Borlänge": "SML-Växjö",
  "C/S Ljungby": "SML-Växjö",
  "C/S Nybro - Stockholm": "SML-Nybro",
  "C/S Stockholm - Kalmar": "SML-Stockholm",
  "C/S Stockholm - Växjö": "SML-Stockholm",
  "C/S Örebro - Kalmar": "SML-Örebro",
  "C/S Örebro - Växjö": "SML-Örebro",
  "CS Malmö - Borlänge": "AHL-Skåne",
  "Coldsped Hbg-V-ö": "SML-Växjö",
  "Coldsped K-stad-V-ö": "SML-Växjö",
  "Coldsped M-öV-ö": "SML-Växjö",
  "Diverse Ljungby": "SML-Värnamo",
  "DSV": "Övrigt",
  "Eksjö - Ljungby": "SML-Växjö",
  "Eksjö - Växjö": "Övrigt",
  "Eksjö-Örebro": "Övrigt",
  "Extrabilar": "Övrigt",
  "Gods Ut": "Övrigt",
  "Gävle - Hultsfred": "SML-Gävle",
  "Gävle-Borlänge": "SML-Gävle",
  "Hudiksvall - Linköping": "SML-Hudiksvall",
  "Hultsfred-Nybro": "SML-Nybro",
  "Hultsfred-Vetlanda": "SML-Hultsfred",
  "Jönköping - Malmö": "SML-Jönköping",
  "Jörgens Bilar": "Övrigt",
  "Karlshamn - Gävle": "SML-Växjö",
  "Karlshamn - Visby": "SML-Växjö",
  "Karlskrona - Visby": "SML-Växjö",
  "Karlskrona - Örebro": "SML-Växjö",
  "Karlskrona InnerN": "DistributionVXO",
  "Karlskrona-Borlänge": "SML-Växjö",
  "Karlskrona-Gävle": "SML-Växjö",
  "Karlskrona-Karlstad": "SML-Växjö",
  "Karlstad - Karlshamn": "SML-Växjö",
  "KARLSTAD-SMÅLAND": "SML-Växjö",
  "Kunder": "Övrigt",
  "Köping": "Övrigt",
  "Lager 157 (Borås)": "Övrigt",
  "Lenhovda": "Övrigt",
  "Linköping - Hudiksvall": "SML-Linköping",
  "Linköping - Markaryd (Avd:1440)": "SML-Linköping",
  "Linköping - Sundsvall": "SML-Linköping",
  "Linköping - Älmhult (Avd:1340)": "SML-Linköping",
  "Ljungby - Jönköping": "SML-Växjö",
  "Ljungby - Stockholm (Avd:1425)": "SML-Värnamo",
  "Ljungby - Västerås": "SML-Värnamo",
  "MMW-LBY": "Övrigt",
  "Malmö - Markaryd": "AHL-Skåne",
  "Markaryd - Jönköping": "SML-Växjö",
  "Markaryd - Linköping": "SML-Växjö",
  "Moheda": "DistributionVXO",
  "Norrköping - Ljungby": "SML-Linköping",
  "Norrköping - Nybro": "SML-Linköping",
  "Nybro - Visby": "SML-Nybro",
  "Nybro-Blekinge": "SML-Nybro",
  "Pulver": "Övrigt",
  "RödebyN": "Övrigt",
  "Stockholm - Åseda": "SML-Stockholm",
  "Stockholm Avisering": "SML-Stockholm",
  "Strålfors - Stockholm": "SML-Värnamo",
  "Sundsvall - Linköping": "SML-Sundsvall",
  "Söderhamn - Kristianstad": "SML-Gävle",
  "Söderhamn - Växjö": "SML-Gävle",
  "TEST - #1325": "Övrigt",
  "TEST - 1325": "Övrigt",
  "VIRKE": "Övrigt",
  "Vetlanda - Ljungby": "SML-Jönköping",
  "Vetlanda - Växjö": "SML-Jönköping",
  "Vetlanda-Hultsfred": "SML-Jönköping",
  "Vetlanda-Karlstad": "SML-Jönköping",
  "Visby - Nybro": "SML-Hultsfred",
  "VÄRNAMO": "SML-Värnamo",
  "Värnamo - Stockholm Markaryd": "SML-Värnamo",
  "Värnamo  - Stockholm Rydaholm": "SML-Värnamo",
  "Västerås - Ljungby (Avd:1420)": "SML-Västerås",
  "Växjö - Vetlanda (Avd:1347)": "SML-Växjö",
  "Växjö - Visby": "SML-Växjö",
  "växjö-kristianstad": "SML-Växjö",
  "SKÅNE-BLGE": "AHL-Skåne",
  "Åryd": "DistributionVXO",
  "Åseda - Stockholm": "SML-Växjö",
  "Älmhult - Borlänge": "SML-Växjö",
  "Älmhult - Jönköping": "SML-Växjö",
  "Älmhult - Linköping": "SML-Växjö",
} as const;

/**
 * Make string comparisons accent-insensitive and case-insensitive.
 */
function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/**
 * Normalize formatting noise so line labels from different sources match.
 */
function normalizeLineName(value: string): string {
  return normalizeText(value)
    .replace(/\(avd:[^)]+\)/g, "")
    .replace(/\s*-/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

// Precompute normalized lookup tables once instead of scanning keys for each lookup.
const NORMALIZED_LINE_TO_CLUSTER = new Map<string, string>();
const REVERSED_NORMALIZED_LINE_TO_CLUSTER = new Map<string, string>();

const ACTIVE_CLUSTER_BLOCKLIST = new Set<string>([
  "ovrigt", // Comment out this row to make "Övrigt" active.
]);

export const ACTIVE_CLUSTERS = Array.from(
  new Set(
    Object.values(LINE_TO_CLUSTER).filter(
      (clusterLabel) => !ACTIVE_CLUSTER_BLOCKLIST.has(normalizeText(clusterLabel)),
    ),
  ),
).sort((a, b) => a.localeCompare(b, "sv"));

const companyPrefixes = ["AHL-", "SML-"] as const;

/**
 * Keep cluster labels clean before prefix handling and comparisons.
 */
function normalizeClusterLabel(value: string): string {
  return value.trim();
}

/**
 * Support matching both A-B and B-A without duplicating mappings.
 */
function reverseLineName(value: string): string {
  const parts = normalizeLineName(value)
    .split("-")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length < 2) {
    return normalizeLineName(value);
  }

  return parts.reverse().join("-");
}

for (const [lineName, cluster] of Object.entries(LINE_TO_CLUSTER)) {
  const normalized = normalizeLineName(lineName);
  // Guard against accidental key collapse if new labels normalize to the same key.
  if (
    process.env.NODE_ENV !== "production" &&
    NORMALIZED_LINE_TO_CLUSTER.has(normalized) &&
    NORMALIZED_LINE_TO_CLUSTER.get(normalized) !== cluster
  ) {
    console.warn(
      "[areaLineConfig] normalizeLineName collision:",
      lineName,
      "->",
      normalized,
      "existing cluster:",
      NORMALIZED_LINE_TO_CLUSTER.get(normalized),
      "new cluster:",
      cluster,
    );
  }
  NORMALIZED_LINE_TO_CLUSTER.set(normalized, cluster);
  REVERSED_NORMALIZED_LINE_TO_CLUSTER.set(reverseLineName(normalized), cluster);
}

/**
 * Remove company prefixes so old group-style filter keys can still resolve.
 */
function stripCompanyPrefix(clusterLabel: string): string {
  const normalized = normalizeClusterLabel(clusterLabel);
  for (const prefix of companyPrefixes) {
    if (normalized.toUpperCase().startsWith(prefix)) {
      return normalized.slice(prefix.length).trim();
    }
  }

  return normalized;
}

/**
 * Map modern cluster labels to legacy aliases used by older saved filters.
 */
function areaAliasFromCluster(clusterLabel: string): string {
  const normalized = normalizeText(clusterLabel).replace(/[^a-z0-9]+/g, "");

  if (
    normalized.includes("distributionvxo") ||
    normalized.includes("distribution") ||
    normalized === "vxo"
  ) {
    return "VXO";
  }

  return stripCompanyPrefix(clusterLabel);
}

/**
 * Convert display labels to stable object keys for persisted filter state.
 */
const toAreaKey = (label: string): string => {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
};

export const AREA_OPTIONS: Record<string, string> = Object.fromEntries(
  ACTIVE_CLUSTERS.map((clusterLabel) => [toAreaKey(clusterLabel), clusterLabel]),
);

export type AreaKey = keyof typeof AREA_OPTIONS;
export type AreaState = Record<AreaKey, boolean>;

export const AREA_KEYS = Object.keys(AREA_OPTIONS) as AreaKey[];

export const DEFAULT_AREAS = Object.fromEntries(
  AREA_KEYS.map((key) => [key, false]),
) as AreaState;

/**
 * Defensive type guard for loosely typed data loaded from storage/database.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Accept both new and legacy filter payload shapes.
 */
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

  // Migration support: map old filter keys to current cluster-based keys.
  const legacyKeyMap = ACTIVE_CLUSTERS.reduce((acc, clusterLabel) => {
    const clusterKey = toAreaKey(clusterLabel);
    const legacyGroupKey = toAreaKey(stripCompanyPrefix(clusterLabel));
    const legacyAreaAliasKey = toAreaKey(areaAliasFromCluster(clusterLabel));

    if (!acc[clusterKey]) {
      acc[clusterKey] = new Set<string>();
    }

    acc[clusterKey].add(legacyGroupKey);
    acc[clusterKey].add(legacyAreaAliasKey);

    return acc;
  }, {} as Record<string, Set<string>>);

  return Object.fromEntries(
    AREA_KEYS.map((key) => {
      const legacyKeys = legacyKeyMap[key] ?? new Set<string>();
      const legacyEnabled = Array.from(legacyKeys).some((legacyKey) => source[legacyKey] === true);

      return [key, source[key] === true || legacyEnabled];
    }),
  ) as AreaState;
}

/**
 * Direct match first, then fallback to reversed direction (A-B <-> B-A).
 */
export function getLineCluster(lineName: string): string | null {
  const normalized = normalizeLineName(lineName);
  const directMatch = NORMALIZED_LINE_TO_CLUSTER.get(normalized);
  if (directMatch) {
    return directMatch;
  }

  return REVERSED_NORMALIZED_LINE_TO_CLUSTER.get(normalized) ?? null;
}

export { normalizeLineName, normalizeText };
