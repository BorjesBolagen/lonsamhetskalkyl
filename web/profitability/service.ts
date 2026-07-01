import "server-only";

import type { ProfitabilityInput, ProfitabilityResult } from "./types";
import { try_steg_1, try_steg_2, try_steg_3, try_steg_4, try_steg_5 } from "./trappsteg_steg";
import { calculateApplicableAddons } from "./addonEngine";
import { roundUpWeight } from "@/lib/backend/utils";
import { ConsignmentListItem } from "@/lib/ilogTypes";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { try_sune_lookup } from "./trappsteg_steg";

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
  const isInvalidInDatabase = (consignment as any)._isDbValidDestination === false;

  if (
    isStyckegodsCustomer ||
    isSchenkerOrDSV ||
    hasStyckeKeywordsInSender ||
    isMissingDestCity ||
    isUnder1000kg ||
    isInvalidInDatabase
  ) {
    return FlowType.STYCKEGODS;
  }

  // =========================================================
  // 5. FJÄRR / DIREKTLASTAT (Övrigt)
  // =========================================================
  return FlowType.FJARR;
}

async function try_paketbur_lookup(
  consignment: ConsignmentListItem
): Promise<number | null> {
  
  if (!consignment.paketburar || consignment.paketburar <= 0) {
    return null; 
  }

  const supabase = await getSupabaseServerClient();

  // AVSÄNDARE
  let fromAbbr = "";
  const pickupZipClean = (consignment.pickupPostalCode || "").replace(/[\s-]/g, "");
  
  // Postnummer
  if (pickupZipClean) {
      const { data } = await (supabase as any).from("tax_point_lookup")
          .select("kontorsforkortning") 
          .eq("postnummer", parseInt(pickupZipClean, 10))
          .maybeSingle();
      if (data?.kontorsforkortning) fromAbbr = data.kontorsforkortning;
  }
  
  // Sök på stad om postnummer saknas
  if (!fromAbbr && consignment.pickupLocationCity) {
      const { data } = await (supabase as any).from("tax_point_lookup")
          .select("kontorsforkortning") 
          .ilike("postort", consignment.pickupLocationCity.trim())
          .limit(1)
          .maybeSingle();
      if (data?.kontorsforkortning) fromAbbr = data.kontorsforkortning;
  }

  // MOTTAGARE
  let toAbbr = "";
  const destZipClean = (consignment.destinationPostalCode || "").replace(/[\s-]/g, "");
  
  // Postnummer
  if (destZipClean) {
      const { data } = await (supabase as any).from("tax_point_lookup")
          .select("kontorsforkortning") 
          .eq("postnummer", parseInt(destZipClean, 10))
          .maybeSingle();
      if (data?.kontorsforkortning) toAbbr = data.kontorsforkortning;
  }

  // Sök på stad om postnummer saknas
  if (!toAbbr && consignment.destinationCity) {
      const { data } = await (supabase as any).from("tax_point_lookup")
          .select("kontorsforkortning") 
          .ilike("postort", consignment.destinationCity.trim())
          .limit(1)
          .maybeSingle();
      if (data?.kontorsforkortning) toAbbr = data.kontorsforkortning;
  }

  if (!fromAbbr || !toAbbr) {
      return null; 
  }

  const relation = `${fromAbbr}-${toAbbr}`.toUpperCase();

  // Leta efter priset
  const { data: priceDataArray, error } = await (supabase as any).from("paketbur_prices")
      .select("*")
      .ilike("relation", `%${relation.trim()}%`); 

  if (error || !priceDataArray || priceDataArray.length === 0) {
      return null; 
  }

  const actualBurar = Number(consignment.paketburar);

  // Avrunda uppåt
  const tierBurar = Math.ceil(actualBurar);

  const correctRow = priceDataArray.find((row: any) => Number(row.antal_burar) === tierBurar);

  if (!correctRow) {
      return null;
  }

  const finalPrice = correctRow.pris * actualBurar;
  return Math.round((finalPrice + Number.EPSILON) * 100) / 100;
}

export async function routeConsignment(
  consignment: ConsignmentListItem,
  input: ProfitabilityInput
): Promise<ProfitabilityResult> {
  const flowType = determineFlowType(consignment);

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
      return await calculateProfitability(input);

    case FlowType.PAKETBUR:
      try {
          const paketburPrice = await try_paketbur_lookup(consignment);
          
          if (paketburPrice !== null) {
              return { 
                  step_used: 0, 
                  estimated_revenue: paketburPrice, 
                  detail: "Paketbur: Enligt prislista" 
              };
          }
          
          return { 
              step_used: -1, 
              estimated_revenue: 0, 
              detail: "Paketbur: Inget pris hittades" 
          };

      } catch (error) {
          console.error("Krasch i Paketburs-flödet:", error);
          return { step_used: -1, estimated_revenue: 0, detail: "Paketbur: Databasfel vid uppslag" };
      }

    case FlowType.STYCKEGODS:
      return { step_used: -1, estimated_revenue: 0, detail: "Styckegods: Beräkningsmodell saknas ännu" };

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
          
          if (!input.taxPointRelation || input.taxPointRelation.trim() === "") {
            return { step_used: -1, estimated_revenue: 0, detail: "Fjärr: Saknar taxepunktsrelation" };
          }
          if (!input.kundnamn || input.kundnamn.trim() === "") {
            return { step_used: -1, estimated_revenue: 0, detail: "Fjärr: Saknar kundnamn" };
          }
          
          return await calculateProfitability(input);

      } catch (error) {
          console.error("Krasch i Sune-flödet:", error);
          return { step_used: -1, estimated_revenue: 0, detail: "Sunes: Databasfel vid uppslag" };
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

/**
 * Lägger tillägg på ett färdigt grundpris från trappstegsmodellen.
 *
 * Om tilläggsberäkningen misslyckas behålls grundpriset så att
 * den befintliga lönsamhetsberäkningen fortfarande fungerar.
 */
async function applyAddons(
  input: ProfitabilityInput,
  baseResult: ProfitabilityResult,
): Promise<ProfitabilityResult> {
  const baseRevenue = roundMoney(baseResult.estimated_revenue);

  try {
    const addonResult = await calculateApplicableAddons(input);
    const addonTotal = roundMoney(addonResult.addonTotal);

    return {
      ...baseResult,
      base_revenue: baseRevenue,
      addon_total: addonTotal,
      estimated_revenue: roundMoney(baseRevenue + addonTotal),
      addons: addonResult.addons,
      addon_warnings: addonResult.warnings,
    };
  } catch (error) {
    console.error(
      "Tilläggen kunde inte beräknas. Grundpriset används:",
      error instanceof Error ? error.message : error,
    );

    return {
      ...baseResult,
      base_revenue: baseRevenue,
      addon_total: 0,
      estimated_revenue: baseRevenue,
      addons: [],
      addon_warnings: [
        {
          code: "ADDON_CALCULATION_FAILED",
          message:
            error instanceof Error
              ? error.message
              : "Tilläggen kunde inte beräknas.",
        },
      ],
    };
  }
}

async function applyNavAdjustments(
  input: ProfitabilityInput,
  currentResult: ProfitabilityResult,
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
    // Värden för fjärr: Min(viktklass, viktklass+1) i tabell (10) (Denna min() görs i supabase)
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
  const taxaValues = nav_values[0];

  // Räkna ut generell kalkyl som :
    // avg term: 1a + 1b*vikt i TON
    // ank term: 2a + 2b*vikt i TON
    // fjärr: 10*vikt i TON
  const generell_avg_term = taxaValues.nav_avg_terminal_direktlastat_frs 
                   + taxaValues.nav_avg_terminal_direktlastat_ton * (weight / 1000);
  const generell_ank_term = taxaValues.nav_ank_terminal_direktlastat_frs
                   + taxaValues.nav_ank_terminal_direktlastat_ton * (weight / 1000);
  const generell_fjarr = taxaValues.nav_taxa_fjarr_direktgods * (weight / 1000);

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

  const andel_avg_term = generell_avg_term / sum_generell;
  const andel_ank_term = generell_ank_term / sum_generell;
  const andel_fjarr = generell_fjarr / sum_generell;

  // Räkna ut fördelningsnetto:
    // Skillnad mellan sum(justerad) och total kundnetto fördelas enligt andel ovan
  const fordelningsnetto_avg_term = (sum_justerad - 
    (currentResult.addon_warnings ? currentResult.estimated_revenue : currentResult.base_revenue!))
    * andel_avg_term;
  const fordelningsnetto_ank_term = (sum_justerad - 
    (currentResult.addon_warnings ? currentResult.estimated_revenue : currentResult.base_revenue!))
    * andel_ank_term;
  const fordelningsnetto_fjarr = (sum_justerad - 
    (currentResult.addon_warnings ? currentResult.estimated_revenue : currentResult.base_revenue!)) 
    * andel_fjarr;
  
  // Räkna ut ersättning exklusive tillägg genom justerad kalkyl + fördelningsnetto
  return {
    ...currentResult,
    nav_error: undefined,
    nav_ers_exklusive_tillägg: {
      avg_term_ers: justerad_avg_term + fordelningsnetto_avg_term,
      ank_term_ers: justerad_ank_term + fordelningsnetto_ank_term,
      fjarr_ers: justerad_fjarr + fordelningsnetto_fjarr
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
  input: ProfitabilityInput
): Promise<ProfitabilityResult> {
  valideraInput(input);
  const weight_plus_one = await roundUpWeight(input.chargeable_weight);

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

  const addonResult = await applyAddons(input, baseResult);
  const navResults = await applyNavAdjustments(input, addonResult);
  return navResults;
}

export function normalizeText(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}
