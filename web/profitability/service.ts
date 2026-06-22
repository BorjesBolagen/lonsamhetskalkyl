import "server-only";

import type { ProfitabilityInput, ProfitabilityResult } from "./types";
import { try_steg_1, try_steg_2, try_steg_3, try_steg_4, try_steg_5 } from "./trappsteg_steg";
import { calculateApplicableAddons } from "./addonEngine";
import { roundUpWeight } from "@/lib/backend/utils";
import { DEFAULT_NAME_SIMILARITY_THRESHOLD } from "@/lib/backend/constants";
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
      return { step_used: -1, estimated_revenue: 0, detail: "Paketbur: Beräkningsmodell saknas ännu" };

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
async function addAddonsToProfitabilityResult(
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

/**
 * Kör hela trappstegsmodellen basically.
 * Om step_used är -1 ( => estimated_revenue = 0) så har ett fel inträffat.
 * I så fall har "detail" mer info om vad som gått snett
 * @param input Alla parametrar som behövs för alla steg i modellen
 * @returns {
 *   step_used: number;
 *   estimated_revenue: number;
 *   detail?: string;
 * }
 */
export async function calculateProfitability(
  input: ProfitabilityInput
): Promise<ProfitabilityResult> {

  valideraInput(input);
  const weight_plus_one = await roundUpWeight(input.chargeable_weight);

  // Försök göra steg 1.
  try {
    const steg1Estimated = await try_steg_1(input, weight_plus_one);

    // Om steg 1 gav null så fick vi ingen träff. Fortsätt med steg 2
    if (steg1Estimated !== null) {
      return await addAddonsToProfitabilityResult(input, {
        ...result,
        step_used: 1,
        estimated_revenue: steg1Estimated
      });
    }
  } catch (error) {
    console.error("Fel i steg 1, fortsätter till steg 2. Felmeddelande:", error instanceof Error ? error.message : error);
    return {
      step_used: -1,
      estimated_revenue: 0,
      detail: "Något gick fel i steg 1"
    }
  }

  // Försök göra steg 2
  try {
    const steg2Estimated = await try_steg_2(input, weight_plus_one);
    
    // Om steg 2 gav null så fick vi ingen träff. Fortsätt med steg 3
    if (steg2Estimated !== null) {
      return await addAddonsToProfitabilityResult(input, {
        ...result,
        step_used: 2,
        estimated_revenue: steg2Estimated
      });
    }
  } catch (error) {
    console.error("Fel i steg 2. Felmeddelande:", error instanceof Error ? error.message : error);
    return {
      step_used: -1,
      estimated_revenue: 0,
      detail: "Något gick fel i steg 2"
    }
  }

  // Försök göra steg 3
  try {
    const steg3Estimated = await (try_steg_3(input, weight_plus_one));

    // Om steg 3 gav null så fick vi ingen träff. Fortsätt med steg 4
    if (steg3Estimated !== null) {
      return await addAddonsToProfitabilityResult(input, {
        ...result,
        step_used: 3,
        estimated_revenue: steg3Estimated
      });
    }
  } catch (error) {
    console.error("Fel i steg 3. Felmeddelande:", error instanceof Error ? error.message : error);
    return {
      step_used: -1,
      estimated_revenue: 0,
      detail: "Något gick fel i steg 3"
    }
  }

  // Försök göra steg 4
  try {
    const steg4Estimated = await try_steg_4(input, weight_plus_one);

    // Om steg 4 gav null så fick vi ingen träff. Fortsätt med steg 5
    if (steg4Estimated !== null) {
      return await addAddonsToProfitabilityResult(input, {
        ...result,
        step_used: 4,
        estimated_revenue: steg4Estimated
      });
    }
  } catch (error) {
    console.error("Fel i steg 4. Felmeddelande:", error instanceof Error ? error.message : error);
    return {
      step_used: -1,
      estimated_revenue: 0,
      detail: "Något gick fel i steg 4"
    }
  }

  // Försök göra steg 5
  try {
    const steg5Estimated = await try_steg_5(input, weight_plus_one);

    // Om steg 5 gav null så fick vi ingen träff. Då har vi testat alla steg i modellen
    if (steg5Estimated !== null) {
      return await addAddonsToProfitabilityResult(input, {
        ...result,
        step_used: 5,
        estimated_revenue: steg5Estimated
      });
    }
  } catch (error) {
    console.error("Fel i steg 5. Felmeddelande:", error instanceof Error ? error.message : error);
    return {
      step_used: -1,
      estimated_revenue: 0,
      detail: "Något gick fel i steg 5"
    }
  }

  return {
    step_used: -1,
    estimated_revenue: 0,
    detail: "Inga steg gav träff"
  }
}

export function normalizeText(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}
