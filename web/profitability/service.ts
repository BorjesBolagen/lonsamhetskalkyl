import "server-only";

import type { AddonWarning, CalculatedAddon, ProfitabilityInput, ProfitabilityResult } from "./types";
import { try_steg_1, try_steg_2, try_steg_3, try_steg_4, try_steg_5 } from "./trappsteg_steg";
import { calculateApplicableAddons } from "./addonEngine";
import { roundUpWeight } from "@/lib/backend/utils";
import { DEFAULT_HVO_PERCENTAGE } from "@/lib/constants";
import { ConsignmentListItem } from "@/lib/ilogTypes";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { try_sune_lookup } from "./trappsteg_steg";
import { try_paketbur_lookup } from "./paketbur";
import { try_styckegods_lookup } from "./styckegods";

// ============================================================================
// STEG 1 - SORTERA FLÖDEN
// ============================================================================
export enum FlowType {
  PAKETBUR = "PAKETBUR",
  STYCKEGODS = "STYCKEGODS",
  FJARR = "FJARR", // = Trappstegsmodellen
  EGENFAKTURERAT = "EGENFAKTURERAT",
  SUNE = "SUNE",
  UNKNOWN = "UNKNOWN"
}

// Identifierar vilket flöde en sändning tillhör.
export function determineFlowType(consignment: ConsignmentListItem): FlowType {
  const destCity = consignment.destinationCity?.toUpperCase() || "";
  const customer = consignment.customerName?.toUpperCase() || "";
  
  // Hämta och slå ihop fälten för att kolla båda samtidigt
  const sender = `${consignment.senderName || ""} ${consignment.pickupLocationName || ""}`.toUpperCase();
  
  const weight = Number(consignment.weight) || 0;

  const lineOrZone = consignment.zoneName?.toUpperCase() || "";

  // =========================================================
  // 1. SUNE (Letar efter "SUNES" i Linje/Zon, Avsändare, Avs-ort och Mott-ort)
  // =========================================================
  if (
    lineOrZone.includes("SUNES") || 
    sender.includes("SUNES") || 
    destCity.includes("SUNES")
  ) {
    return FlowType.SUNE;
  }

  // =========================================================
  // 2. EGENFAKTURERAT
  // =========================================================
  if (
    consignment.invoiceStatus && 
    consignment.invoiceStatus.trim() !== "" && 
    consignment.internalPrice && 
    consignment.internalPrice > 0
  ) {
    return FlowType.EGENFAKTURERAT;
  }

  // =========================================================
  // 3. PAKETBUR
  // =========================================================
  if (
    customer.includes("PAKETBUR") || 
    customer.includes("PAKET") ||
    customer.includes("PARCEL")
  ) {
    return FlowType.PAKETBUR;
  }

  // =========================================================
  // 4. STYCKEGODS
  // =========================================================
  const isStyckegodsCustomer = customer.includes("STYCKE");
  
  // Schenker eller DSV (med mellanslag efter) i avsändare
  const isSchenkerOrDSV = 
    sender.includes("SCHENK") || sender.includes("DSV ");
    
  // Specifika sökord i avsändare
  const hasStyckeKeywordsInSender = 
    sender.includes("MARKPLAN") || 
    sender.includes("TUNGGODS") || 
    sender.includes("STYCKE") || 
    sender.includes("FAST");
    
  // Saknar mottagarort
  const isMissingDestCity = destCity === ""; 
  
  // Vikt-gränsen
  const isUnder1000kg = weight > 0 && weight < 1000;
  
  //Postnummer/postort finns ej
  // const isInvalidInDatabase = (consignment as any)._isDbValidDestination === false;

  if (
    isStyckegodsCustomer ||
    isSchenkerOrDSV ||
    hasStyckeKeywordsInSender ||
    isMissingDestCity ||
    isUnder1000kg
    //isInvalidInDatabase
  ) {
    return FlowType.STYCKEGODS;
  }

  // =========================================================
  // 5. FJÄRR / DIREKTLASTAT (Övrigt)
  // =========================================================
  return FlowType.FJARR;
}

export async function routeConsignment(
  consignment: ConsignmentListItem,
  input: ProfitabilityInput
): Promise<ProfitabilityResult> {
  const flowType = determineFlowType(consignment);

  const consignmentWithLineRelation = consignment as ConsignmentListItem & {
    linjerel?: string | null;
    linjeRel?: string | null;
    lineRelation?: string | null;
    line_relation?: string | null;
  };

  const inputWithLineRelation: ProfitabilityInput = {
    ...input,
    linjerel:
      input.linjerel
      ?? consignmentWithLineRelation.linjerel
      ?? consignmentWithLineRelation.linjeRel
      ?? consignmentWithLineRelation.lineRelation
      ?? consignmentWithLineRelation.line_relation
      ?? consignment.zoneName
      ?? null,
  };

  // Hjälpfunktion: Om ett specialflöde misslyckas, skicka till Trappstegsmodellen
  const fallbackToTrappsteg = async (
    reason: string,
    dmtMode: DmtMode = "distance",
  ) => {
    console.warn(`${reason}-uppslag misslyckades, skickar till Fjärr (Trappstegsmodellen)...`);
    if (!input.taxPointRelation || input.taxPointRelation.trim() === "") {
      return { step_used: -1, estimated_revenue: 0, detail: `Fjärr: Saknar taxepunktsrelation (Fallback från ${reason})` };
    }
    if (!input.kundnamn || input.kundnamn.trim() === "") {
      return { step_used: -1, estimated_revenue: 0, detail: `Fjärr: Saknar kundnamn (Fallback från ${reason})` };
    }
    return await calculateProfitability(inputWithLineRelation, { dmtMode });
  };

  switch (flowType) {
    case FlowType.FJARR:
      // Om Fjärr saknar Taxepunkter, returnera ett fel istället för att krascha
      if (!input.taxPointRelation || input.taxPointRelation.trim() === "") {
        return { step_used: -1, estimated_revenue: 0, detail: "Fjärr: Saknar taxepunktsrelation" };
      }
      if (!input.kundnamn || input.kundnamn.trim() === "") {
        return { step_used: -1, estimated_revenue: 0, detail: "Fjärr: Saknar kundnamn" };
      }
      
      // Skicka in till trappstegsmodellen
      return await calculateProfitability(inputWithLineRelation);

    case FlowType.PAKETBUR:
      try {
          const paketburPrice = await try_paketbur_lookup(consignment);
          
          if (paketburPrice !== null) {
              return await applyAddons(
                inputWithLineRelation,
                { 
                    step_used: 0, 
                    estimated_revenue: paketburPrice, 
                    detail: "Paketbur: Enligt prislista" 
                },
                {
                  includeLocationAndCustomerAddons: false,
                  includeHvoAddon: false,
                  dmtMode: "fjarr_paket",
                },
              );
          }
          
          // Hittades inte, kör trappstegsmodellen
          return await fallbackToTrappsteg("Paketbur");

      } catch (error) {
          console.error("Krasch i Paketburs-flödet:", error);
          return await fallbackToTrappsteg("Paketbur (Databasfel)");
      }

    case FlowType.STYCKEGODS:
      try {
          const styckeResult = await try_styckegods_lookup(consignment);

          if (styckeResult !== null) {
              const styckegodsInput: ProfitabilityInput = {
                ...inputWithLineRelation,
                distanceKm:
                  styckeResult.distanceKm
                  ?? inputWithLineRelation.distanceKm
                  ?? null,
              };

              return await applyAddons(
                styckegodsInput,
                {
                    step_used: 0,
                    base_revenue: styckeResult.basePrice,
                    estimated_revenue: styckeResult.price,
                    addons: styckeResult.addons,
                    detail: styckeResult.method,
                },
                {
                  includeLocationAndCustomerAddons: false,
                  includeHvoAddon: false,
                  dmtMode: "distance",
                },
              );
          }

          // Hittades inte, kör trappstegsmodellen
          return await fallbackToTrappsteg("Styckegods");

      } catch (error) {
          console.error("Krasch i Styckegods-flödet:", error);
          return await fallbackToTrappsteg("Styckegods (Databasfel)");
      }

    case FlowType.EGENFAKTURERAT:
      return { 
        step_used: 0,
        estimated_revenue: consignment.internalPrice || 0, 
        detail: `Egenfakturerat: ${consignment.invoiceStatus}`
      };

    case FlowType.SUNE:
      try {
          // Försök hitta pris i Sunes databastabell
          const sunePrice = await try_sune_lookup(consignment);
          
          if (sunePrice !== null) {
              return { 
                  step_used: 0, // För frontend: 0 = "Sune"
                  estimated_revenue: sunePrice, 
                  detail: "Sunes prislista" 
              };
          }
          
          // Hittades inte, kör trappstegsmodellen
          console.warn("Sune-uppslag misslyckades (finns ej i prislistan), skickar till Fjärr...");
          return await fallbackToTrappsteg("Sune");

      } catch (error) {
          console.error("Krasch i Sune-flödet:", error);
          return await fallbackToTrappsteg("Sune (Databasfel)");
      }

    default:
      return { step_used: -1, estimated_revenue: 0, detail: "Okänd frakttyp, kunde inte sorteras" };
  }
}

// ============================================================================
// TRAPPSTEGSMODELLEN (Fjärr/Direktlastat)
// ============================================================================

function valideraInput(input: ProfitabilityInput) {
    // Validera input
    if (!input.kundnamn) {
        throw new Error("Kundnamn måste fyllas i.");
    }
    if (!input.taxPointRelation) {
        throw new Error("Taxepunkter måste fyllas i.");
    }
    if (isNaN(input.chargeable_weight)) {
        throw new Error("Levererad vikt måste vara ett giltigt tal.");
    }
}


/**
 * Avrundar ett pris till två decimaler.
 */
function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}


type HvoCustomerRow = {
  name: string | null;
};

type UserHvoSettingsRow = {
  filters: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null
    && typeof value === "object"
    && !Array.isArray(value)
  );
}

function normalizeCustomerKey(
  value: string | null | undefined,
): string {
  return (value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function getHvoPercentageFromFilters(filters: unknown): number | null {
  if (!isRecord(filters) || !("hvoPercentage" in filters)) {
    return null;
  }

  const numericValue = Number(filters.hvoPercentage);

  return Number.isFinite(numericValue) && numericValue >= 0
    ? numericValue
    : null;
}

function formatPercentage(value: number): string {
  return new Intl.NumberFormat(
    "sv-SE",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    },
  ).format(value);
}

function getBaseRevenueValue(result: ProfitabilityResult): number {
  return roundMoney(result.base_revenue ?? result.estimated_revenue);
}


type DmtMode = "distance" | "fjarr_paket" | "none";

type AddonApplicationOptions = {
  includeLocationAndCustomerAddons?: boolean;
  includeHvoAddon?: boolean;
  dmtMode?: DmtMode;
  addonBaseRevenue?: number;
  dmtBaseRevenue?: number;
  resultBaseRevenue?: number;
};

type CalculateProfitabilityOptions = {
  dmtMode?: DmtMode;
};

type DmtRow = {
  id?: number | null;
  valid_from: string | null;
  valid_to: string | null;
  rule_type: string | null;
  rule_key: string | null;
  km_from: number | string | null;
  km_to: number | string | null;
  percentage: number | string | null;
};

function toFiniteNumber(value: unknown, fallback = 0): number {
  const numericValue = Number(value);

  return Number.isFinite(numericValue)
    ? numericValue
    : fallback;
}

function normalizeDateString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return /^\d{4}-\d{2}-\d{2}$/.test(normalized)
    ? normalized
    : null;
}

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDmtPeriodKey(row: DmtRow): string {
  return `${row.valid_from ?? ""}|${row.valid_to ?? ""}`;
}

function selectApplicableDmtRows(rows: DmtRow[]): DmtRow[] {
  if (rows.length === 0) {
    return [];
  }

  const today = getTodayDateString();

  const activeRows = rows.filter((row) => {
    const validFrom = normalizeDateString(row.valid_from);
    const validTo = normalizeDateString(row.valid_to);

    return Boolean(
      validFrom
      && validTo
      && validFrom <= today
      && validTo >= today,
    );
  });

  const candidates = activeRows.length > 0
    ? activeRows
    : rows;

  const sortedRows = [...candidates].sort((a, b) => {
    const aFrom = normalizeDateString(a.valid_from) ?? "";
    const bFrom = normalizeDateString(b.valid_from) ?? "";

    if (aFrom !== bFrom) {
      return bFrom.localeCompare(aFrom);
    }

    const aTo = normalizeDateString(a.valid_to) ?? "";
    const bTo = normalizeDateString(b.valid_to) ?? "";

    return bTo.localeCompare(aTo);
  });

  const selectedPeriod = getDmtPeriodKey(sortedRows[0]);

  return sortedRows.filter(
    (row) => getDmtPeriodKey(row) === selectedPeriod,
  );
}

function normalizeDmtRuleKey(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toUpperCase()
    .replace(/Å/g, "A")
    .replace(/Ä/g, "A")
    .replace(/Ö/g, "O")
    .replace(/[^0-9A-Z]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseTaxPoint(value: string | number | null | undefined): number | null {
  const normalized = String(value ?? "").replace(/[^0-9]/g, "");

  if (!normalized) {
    return null;
  }

  const taxPoint = Number(normalized);

  return Number.isFinite(taxPoint)
    ? taxPoint
    : null;
}

function getTaxPointsFromInput(input: ProfitabilityInput): {
  senderTaxPoint: number | null;
  receiverTaxPoint: number | null;
} {
  const directSenderTaxPoint = parseTaxPoint(input.senderTaxPoint);
  const directReceiverTaxPoint = parseTaxPoint(input.receiverTaxPoint);

  if (directSenderTaxPoint !== null && directReceiverTaxPoint !== null) {
    return {
      senderTaxPoint: directSenderTaxPoint,
      receiverTaxPoint: directReceiverTaxPoint,
    };
  }

  const parts = (input.taxPointRelation ?? "")
    .split(/[\-–—]/)
    .map((part) => parseTaxPoint(part));

  return {
    senderTaxPoint: directSenderTaxPoint ?? parts[0] ?? null,
    receiverTaxPoint: directReceiverTaxPoint ?? parts[1] ?? null,
  };
}

function getInputDistanceKm(input: ProfitabilityInput): number | null {
  const distanceKm = toFiniteNumber(input.distanceKm, NaN);

  return Number.isFinite(distanceKm) && distanceKm > 0
    ? distanceKm
    : null;
}

async function queryDistanceMapKm(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  sender: number,
  receiver: number,
): Promise<number | null> {
  const { data, error } = await (supabase as any)
    .from("distance_map" as any)
    .select("distance")
    .eq("sender", sender)
    .eq("receiver", receiver)
    .maybeSingle();

  if (error) {
    throw new Error(`Avstånd för DMT kunde inte hämtas: ${error.message}`);
  }

  const distanceKm = toFiniteNumber(data?.distance, NaN);

  return Number.isFinite(distanceKm) && distanceKm > 0
    ? distanceKm
    : null;
}

async function resolveDistanceKm(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  input: ProfitabilityInput,
): Promise<number | null> {
  const directDistanceKm = getInputDistanceKm(input);

  if (directDistanceKm !== null) {
    return directDistanceKm;
  }

  const { senderTaxPoint, receiverTaxPoint } = getTaxPointsFromInput(input);

  if (senderTaxPoint === null || receiverTaxPoint === null) {
    return null;
  }

  const directDistance = await queryDistanceMapKm(
    supabase,
    senderTaxPoint,
    receiverTaxPoint,
  );

  if (directDistance !== null) {
    return directDistance;
  }

  // distance_map kan ligga speglad beroende på hur relationen importerats.
  // Testa därför även omvänd taxepunktsrelation innan DMT uteblir.
  return await queryDistanceMapKm(
    supabase,
    receiverTaxPoint,
    senderTaxPoint,
  );
}

function findDistanceDmtRow(rows: DmtRow[], distanceKm: number): DmtRow | null {
  return rows.find((row) => {
    if (normalizeDmtRuleKey(row.rule_type) !== "KM_INTERVAL") {
      return false;
    }

    const kmFrom = toFiniteNumber(row.km_from, NaN);
    const kmToRaw = row.km_to;
    const kmTo = kmToRaw === null || kmToRaw === undefined
      ? null
      : toFiniteNumber(kmToRaw, NaN);

    if (!Number.isFinite(kmFrom) || distanceKm < kmFrom) {
      return false;
    }

    return kmTo === null || (Number.isFinite(kmTo) && distanceKm <= kmTo);
  }) ?? null;
}

function findDmtRowByKeys(
  rows: DmtRow[],
  acceptedKeys: string[],
): DmtRow | null {
  const normalizedAcceptedKeys = acceptedKeys.map(normalizeDmtRuleKey);

  return rows.find((row) => {
    const ruleKey = normalizeDmtRuleKey(row.rule_key);
    const ruleType = normalizeDmtRuleKey(row.rule_type);

    return normalizedAcceptedKeys.includes(ruleKey)
      || normalizedAcceptedKeys.includes(ruleType);
  }) ?? null;
}

function findFjarrPaketDmtRow(rows: DmtRow[]): DmtRow | null {
  return findDmtRowByKeys(
    rows,
    [
      "FJARR_PAKET",
      "PAKETBUR_FJARR",
      "PAKETBUR/FJARR",
      "PAKETBUR / FJARR",
    ],
  );
}

function buildDmtAddonName(
  percentage: number,
  mode: DmtMode,
  distanceKm: number | null,
): string {
  const percentageText = formatPercentage(percentage);

  if (mode === "fjarr_paket") {
    return `DMT-tillägg Paketbur/Fjärr ${percentageText} %`;
  }

  if (distanceKm !== null) {
    return `DMT-tillägg ${percentageText} % (${Math.round(distanceKm)} km)`;
  }

  return `DMT-tillägg ${percentageText} %`;
}

async function resolveDmtAddon(
  input: ProfitabilityInput,
  baseRevenue: number,
  mode: DmtMode,
): Promise<CalculatedAddon | null> {
  if (mode === "none" || baseRevenue <= 0) {
    return null;
  }

  const supabase = await getSupabaseServerClient();

  const { data, error } = await (supabase as any)
    .from("addon_dmt" as any)
    .select("id, valid_from, valid_to, rule_type, rule_key, km_from, km_to, percentage")
    .order("valid_from", { ascending: false })
    .limit(1_000);

  if (error) {
    throw new Error(`DMT-inställningen kunde inte hämtas: ${error.message}`);
  }

  const rows = Array.isArray(data)
    ? (data as DmtRow[])
    : [];

  const applicableRows = selectApplicableDmtRows(rows);

  if (applicableRows.length === 0) {
    return null;
  }

  let matchedDistanceKm: number | null = null;

  let matchedRow: DmtRow | null = null;

  if (mode === "fjarr_paket") {
    matchedRow = findFjarrPaketDmtRow(applicableRows);
  }

  const row = matchedRow ?? (mode === "distance"
    ? await (async () => {
        matchedDistanceKm = await resolveDistanceKm(supabase, input);

        return matchedDistanceKm === null
          ? null
          : findDistanceDmtRow(applicableRows, matchedDistanceKm);
      })()
    : null);

  if (!row) {
    return null;
  }

  const percentage = toFiniteNumber(row.percentage, 0);

  if (percentage <= 0) {
    return null;
  }

  const amount = roundMoney(baseRevenue * (percentage / 100));

  if (amount <= 0) {
    return null;
  }

  return {
    id: -30_000,
    type: "dmttillagg",
    direction: "route",
    name: buildDmtAddonName(percentage, mode, matchedDistanceKm),
    amount,
    class: null,
    region: null,
    lookupSource: "dmt_rule",
    matchedTaxPoint: null,
    matchedCity: null,
  };
}

async function getConfiguredHvoPercentage(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
): Promise<number> {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;

  if (!userId) {
    return DEFAULT_HVO_PERCENTAGE;
  }

  const { data, error } = await supabase
    .from("User")
    .select("filters")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`HVO-inställningen kunde inte hämtas: ${error.message}`);
  }

  const valueFromFilters = getHvoPercentageFromFilters(
    (data as UserHvoSettingsRow | null)?.filters,
  );

  return valueFromFilters ?? DEFAULT_HVO_PERCENTAGE;
}

async function resolveHvoAddon(
  input: ProfitabilityInput,
  baseRevenue: number,
): Promise<CalculatedAddon | null> {
  const customerKey = normalizeCustomerKey(input.kundnamn);

  if (!customerKey || baseRevenue <= 0) {
    return null;
  }

  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from("addon_hvo")
    .select("name");

  if (error) {
    throw new Error(`HVO-kunder kunde inte hämtas: ${error.message}`);
  }

  const rows = Array.isArray(data)
    ? (data as HvoCustomerRow[])
    : [];

  const isHvoCustomer = rows.some(
    (row) => normalizeCustomerKey(row.name) === customerKey,
  );

  if (!isHvoCustomer) {
    return null;
  }

  const hvoPercentage = await getConfiguredHvoPercentage(supabase);
  const amount = roundMoney(baseRevenue * (hvoPercentage / 100));

  if (amount <= 0) {
    return null;
  }

  return {
    id: -20_000,
    type: "hvotillagg",
    direction: "route",
    name: `HVO-tillägg ${formatPercentage(hvoPercentage)} %`,
    amount,
    class: null,
    region: null,
    lookupSource: "name",
    matchedTaxPoint: null,
    matchedCity: null,
  };
}

/**
 * Lägger tillägg på ett färdigt grundpris.
 *
 * Om en tilläggsberäkning misslyckas behålls grundpriset så att
 * den befintliga lönsamhetsberäkningen fortfarande fungerar.
 */
async function applyAddons(
  input: ProfitabilityInput,
  baseResult: ProfitabilityResult,
  options: AddonApplicationOptions = {},
): Promise<ProfitabilityResult> {
  const sourceBaseRevenue = getBaseRevenueValue(baseResult);
  const addonBaseRevenue = roundMoney(
    options.addonBaseRevenue ?? sourceBaseRevenue,
  );
  const dmtBaseRevenue = roundMoney(
    options.dmtBaseRevenue ?? addonBaseRevenue,
  );
  const resultBaseRevenue = roundMoney(
    options.resultBaseRevenue ?? sourceBaseRevenue,
  );

  const addons: CalculatedAddon[] = Array.isArray(baseResult.addons)
    ? [...baseResult.addons]
    : [];

  const addonWarnings: AddonWarning[] = Array.isArray(baseResult.addon_warnings)
    ? [...baseResult.addon_warnings]
    : [];

  const includeLocationAndCustomerAddons =
    options.includeLocationAndCustomerAddons ?? true;

  const includeHvoAddon =
    options.includeHvoAddon ?? true;

  const dmtMode =
    options.dmtMode ?? "distance";

  if (includeLocationAndCustomerAddons) {
    try {
      const addonResult = await calculateApplicableAddons(input);
      addons.push(...addonResult.addons);
      addonWarnings.push(...addonResult.warnings);
    } catch (error) {
      console.error(
        "Tilläggen kunde inte beräknas. Grundpriset används för övriga tillägg:",
        error instanceof Error ? error.message : error,
      );

      addonWarnings.push({
        code: "ADDON_CALCULATION_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Tilläggen kunde inte beräknas.",
      });
    }
  }

  if (includeHvoAddon) {
    try {
      const hasHvoAddon = addons.some((addon) => addon.type === "hvotillagg");
      const hvoAddon = hasHvoAddon
        ? null
        : await resolveHvoAddon(input, addonBaseRevenue);

      if (hvoAddon) {
        addons.push(hvoAddon);
      }
    } catch (error) {
      console.error(
        "HVO-tillägget kunde inte beräknas:",
        error instanceof Error ? error.message : error,
      );

      addonWarnings.push({
        code: "HVO_ADDON_CALCULATION_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "HVO-tillägget kunde inte beräknas.",
      });
    }
  }

  if (dmtMode !== "none") {
    try {
      const hasDmtAddon = addons.some((addon) => addon.type === "dmttillagg");
      const dmtAddon = hasDmtAddon
        ? null
        : await resolveDmtAddon(input, dmtBaseRevenue, dmtMode);

      if (dmtAddon) {
        addons.push(dmtAddon);
      }
    } catch (error) {
      console.error(
        "DMT-tillägget kunde inte beräknas:",
        error instanceof Error ? error.message : error,
      );

      addonWarnings.push({
        code: "DMT_ADDON_CALCULATION_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "DMT-tillägget kunde inte beräknas.",
      });
    }
  }

  const addonTotal = roundMoney(
    addons.reduce(
      (sum, addon) => sum + addon.amount,
      0,
    ),
  );

  return {
    ...baseResult,
    base_revenue: resultBaseRevenue,
    addon_total: addonTotal,
    estimated_revenue: roundMoney(resultBaseRevenue + addonTotal),
    addons,
    addon_warnings: addonWarnings,
  };
}

async function applyNavAdjustments(
  input: ProfitabilityInput,
  currentResult: ProfitabilityResult,
  weight_plus_one: number
): Promise<ProfitabilityResult> {
  
  const supabase = await getSupabaseServerClient();

  // Ta fram relevanta parametrar
  const [sender_taxep, receiver_taxep] = input.taxPointRelation.trim().split("-").map(Number) || [];
  const weight = input.chargeable_weight;   // Vikt i kilogram
  const { data: distance, error: distance_error } = await supabase.rpc("get_distance", {
    in_sender_taxep: sender_taxep,
    in_receiver_taxep: receiver_taxep
  });   // Distans i km

  if (distance_error) {
    console.error("Fel vid distansberäkning för NAV: " + distance_error.message);
    return {
      ...currentResult,
      nav_error: distance_error.message,
      nav_ers_exklusive_tillägg: undefined
    }
  }

  // Få från tabeller:
    // Värden för avg term: NAV taxa kr/snd (1a) och NAV taxa kr/ton (1b)
    // Värden för ank term: NAV taxa kr/snd (2a) och NAV taxa kr/ton (2b)
    // Värden för fjärr: Både med nuvarande viktklass och viktklass+1
  const { data: nav_values, error: nav_error } = await supabase.rpc("get_nav_values", {
    p_kg: weight,
    p_km: distance
  });
  
  if (nav_error) {
    console.error("Fel vid hämtning av NAV taxor: " + nav_error.message);
    return {
      ...currentResult,
      nav_error: nav_error.message,
      nav_ers_exklusive_tillägg: undefined
    }
  }

  const taxaValues = Array.isArray(nav_values) ? nav_values[0] : undefined;

  // get_nav_values kan sakna rad för t.ex. vikter utanför taxetabellen.
  // Utan denna kontroll kraschar hela lönsamhetsberäkningen och bokningen
  // blir helt utan prognos i Hem-vyn.
  if (!taxaValues) {
    console.error(
      `NAV-taxor saknas för vikt ${weight} kg och avstånd ${distance} km.`,
    );
    return {
      ...currentResult,
      nav_error: `NAV-taxor saknas för vikt ${weight} kg och avstånd ${distance} km.`,
      nav_ers_exklusive_tillägg: undefined
    }
  }

  // Räkna ut generell kalkyl som :
    // avg term: 1a + 1b*vikt i TON
    // ank term: 2a + 2b*vikt i TON
    // fjärr: 10*vikt i TON
  const generell_avg_term = taxaValues.nav_avg_terminal_direktlastat_frs
                   + taxaValues.nav_avg_terminal_direktlastat_ton * (weight / 1000);
  const generell_ank_term = taxaValues.nav_ank_terminal_direktlastat_frs
                   + taxaValues.nav_ank_terminal_direktlastat_ton * (weight / 1000);

  // Ta hänsyn till brytpunktsberäkning
  const generell_fjarr_current = toFiniteNumber(taxaValues.nav_taxa_fjarr_current, 0) * (weight / 1000);

  // Brytpunkten gäller bara om det faktiskt finns en viktklass ovanför:
  // saknas nästa viktklass (round_up_weight ger 0/-1) eller saknas taxan för
  // den (nav_taxa_fjarr_above är null) blir alternativet 0 kr, och ett
  // rakt min() nollställer då hela fjärrdelen — dvs bokningen får ingen summa.
  const taxa_fjarr_above = toFiniteNumber(taxaValues.nav_taxa_fjarr_above, 0);
  const harBrytpunkt = weight_plus_one > weight && taxa_fjarr_above > 0;
  const generell_fjarr_above = harBrytpunkt
    ? taxa_fjarr_above * (weight_plus_one / 1000)
    : null;

  if (!harBrytpunkt) {
    console.warn(
      `Ingen giltig brytpunkt för vikt ${weight} kg `
      + `(viktklass+1: ${weight_plus_one}, taxa ovanför: ${taxaValues.nav_taxa_fjarr_above}). `
      + "Använder aktuell viktklass för fjärrdelen.",
    );
  }

  // Välj mindre av de två, men bara när brytpunkten finns
  const generell_fjarr = generell_fjarr_above !== null
    ? Math.min(generell_fjarr_current, generell_fjarr_above)
    : generell_fjarr_current;

  // Saknas fjärrtaxa helt (t.ex. vikt utanför taxetabellen) blir fjärrandelen 0
  // och prognosen visar 0 kr trots att kundnettot är beräknat. Behandla det som
  // ett NAV-fel istället, så faller beräkningen tillbaka på hela kundnettot.
  if (!(generell_fjarr > 0)) {
    const message =
      `NAV-taxa för fjärr saknas eller är 0 för vikt ${weight} kg `
      + `och avstånd ${distance} km. Kundnettot används utan NAV-fördelning.`;

    console.error(message);

    return {
      ...currentResult,
      nav_error: message,
      nav_ers_exklusive_tillägg: undefined
    };
  }

  // Räkna ut justerad kalkyl som:
    // avg/ank terminal samma
    // fjärr: generell * koeff från tabell
  const justerad_avg_term = generell_avg_term;
  const justerad_ank_term = generell_ank_term;

  const { data: coefficient, error: coefficient_error } = await supabase.rpc("get_coefficient", {
    p_from_taxepunkt: sender_taxep,
    p_to_taxepunkt: receiver_taxep
  });

  if (coefficient_error) {
    console.error("Fel vid hämtning av koefficient: ", coefficient_error.message);
    return {
      ...currentResult,
      nav_error: coefficient_error.message,
      nav_ers_exklusive_tillägg: undefined
    }
  }

  const justerad_fjarr = generell_fjarr * coefficient;

  // Räkna ut ersättning andel:
    // Alla tre: andelen generell / sum(alla tre generell)  
  const sum_justerad = justerad_avg_term + justerad_ank_term + justerad_fjarr;
  const sum_generell = generell_avg_term + generell_ank_term + generell_fjarr;

  if (!Number.isFinite(sum_generell) || sum_generell <= 0) {
    return {
      ...currentResult,
      nav_error: "NAV-fördelningen kunde inte beräknas eftersom generell summa är 0.",
      nav_ers_exklusive_tillägg: undefined
    };
  }

  const andel_avg_term = generell_avg_term / sum_generell;
  const andel_ank_term = generell_ank_term / sum_generell;
  const andel_fjarr = generell_fjarr / sum_generell;

  // Räkna ut fördelningsnetto:
    // Skillnad mellan sum(justerad) och total kundnetto fördelas enligt andel ovan
  const baseRevenue = getBaseRevenueValue(currentResult);
  const gap = baseRevenue - sum_justerad;
  const fordelningsnetto_avg_term = gap * andel_avg_term;
  const fordelningsnetto_ank_term = gap * andel_ank_term;
  const fordelningsnetto_fjarr = gap * andel_fjarr;

  // Räkna ut ersättning exklusive tillägg genom justerad kalkyl + fördelningsnetto
  return {
    ...currentResult,
    nav_error: undefined,
    nav_ers_exklusive_tillägg: {
      avg_term_ers: roundMoney(justerad_avg_term + fordelningsnetto_avg_term),
      ank_term_ers: roundMoney(justerad_ank_term + fordelningsnetto_ank_term),
      fjarr_ers: roundMoney(justerad_fjarr + fordelningsnetto_fjarr)
    }
  } as ProfitabilityResult;
}

type BaseCalculationStep = {
  step: number;
  label: string;
  executor: (
    input: ProfitabilityInput,
    weight_plus_one: number
  ) => Promise<number | null>;
};

const BASE_CALCULATION_STEPS: BaseCalculationStep[] = [
  { step: 1, label: "steg 1", executor: try_steg_1 },
  { step: 2, label: "steg 2", executor: try_steg_2 },
  { step: 3, label: "steg 3", executor: try_steg_3 },
  { step: 4, label: "steg 4", executor: try_steg_4 },
  { step: 5, label: "steg 5", executor: try_steg_5 },
];

/**
 * Trappstegsmodellen. Hittar kundnetto för sändelse
 */
async function calculateBaseRevenue(
  input: ProfitabilityInput,
  weight_plus_one: number,
): Promise<ProfitabilityResult | null> {
  for (const step of BASE_CALCULATION_STEPS) {
    try {
      const estimated = await step.executor(input, weight_plus_one);

      if (estimated !== null) {
        return {
          step_used: step.step,
          estimated_revenue: estimated,
        };
      }
    } catch (error) {
      console.error(
        `Fel i ${step.label}. Felmeddelande:`,
        error instanceof Error ? error.message : error,
      );

      return {
        step_used: -1,
        estimated_revenue: 0,
        detail: `Något gick fel i ${step.label}`,
      };
    }
  }

  return null;
}

/**
 * Kör hela trappstegsmodellen.
 * Om step_used är -1 ( => estimated_revenue = 0) så har ett fel inträffat.
 * I så fall har "detail" mer info om vad som gått snett.
 *
 * @param input Alla parametrar som behövs för alla steg i modellen
 */
export async function calculateProfitability(
  input: ProfitabilityInput,
  options: CalculateProfitabilityOptions = {},
): Promise<ProfitabilityResult> {
  valideraInput(input);
  const weight_plus_one = await roundUpWeight(input.chargeable_weight);
  const addonOptions: AddonApplicationOptions = {
    dmtMode: options.dmtMode ?? "distance",
  };

  const baseResult = await calculateBaseRevenue(input, weight_plus_one);

  if (!baseResult) {
    return {
      step_used: -1,
      estimated_revenue: 0,
      detail: "Inga steg gav träff",
    };
  }

  if (baseResult.step_used === -1) {
    return baseResult;
  }

  const customerNetRevenue = getBaseRevenueValue(baseResult);
  const baseResultWithCustomerNet: ProfitabilityResult = {
    ...baseResult,
    base_revenue: customerNetRevenue,
    estimated_revenue: customerNetRevenue,
  };

  const navResult = await applyNavAdjustments(
    input,
    baseResultWithCustomerNet,
    weight_plus_one,
  );

  const directLoadedFjarrRevenue = navResult.nav_ers_exklusive_tillägg?.fjarr_ers
    ?? customerNetRevenue;

  return await applyAddons(
    input,
    {
      ...navResult,
      customer_net_revenue: customerNetRevenue,
    },
    {
      ...addonOptions,
      addonBaseRevenue: customerNetRevenue,
      dmtBaseRevenue: directLoadedFjarrRevenue,
      resultBaseRevenue: directLoadedFjarrRevenue,
    },
  );
}

export function normalizeText(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}