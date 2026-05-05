import "server-only";

import type { ProfitabilityInput, ProfitabilityResult } from "./types";
import { try_steg_1, try_steg_2, try_steg_3, try_steg_4, try_steg_5 } from "./trappsteg_steg";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { roundUpWeight } from "@/lib/backend/utils";


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
  const weight = Number(input.chargeable_weight);

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_weight_class", {
    input_weight: weight
  })

  if (error) {
    console.error("Fel vid hämtning av viktklass: ", error);
    throw new Error("Fel vid hämtning av viktklass: " + error.message);
  }

  // Vi ska bara köra trappstegsmodellen för viktklasser över 20. Skippa alla <= 20
  if (data <= 20) {
    return {
      step_used: -1,
      estimated_revenue: 0,
      detail: "Endast viktklasser över 20 hanteras"
    }
  }

  valideraInput(input);
  const weight_plus_one = await roundUpWeight(input.chargeable_weight);

  const steg1Start = performance.now();
  // Försök göra steg 1.
  try {
    const steg1Estimated = await try_steg_1(input, weight_plus_one);

    // Om steg 1 gav null så fick vi ingen träff. Fortsätt med steg 2
    if (steg1Estimated !== null) {
      console.log("Steg 1 för kund", input.kundnamn, performance.now() - steg1Start);
      return {
        step_used: 1,
        estimated_revenue: steg1Estimated
      }
    }
  } catch (error) {
    console.error("Fel i steg 1, fortsätter till steg 2. Felmeddelande:", error instanceof Error ? error.message : error);
    return {
      step_used: -1,
      estimated_revenue: 0,
      detail: "Något gick fel i steg 1"
    }
  }
  const steg1Time = performance.now() - steg1Start;
  const steg2Start = performance.now();
  // Försök göra steg 2
  try {
    const steg2Estimated = await try_steg_2(input, weight_plus_one);
    
    // Om steg 2 gav null så fick vi ingen träff. Fortsätt med steg 3
    if (steg2Estimated !== null) {
      console.log("Steg 2 för kund", input.kundnamn, steg1Time, performance.now() - steg2Start);
      return {
        step_used: 2,
        estimated_revenue: steg2Estimated
      }
    }
  } catch (error) {
    console.error("Fel i steg 2. Felmeddelande:", error instanceof Error ? error.message : error);
    return {
      step_used: -1,
      estimated_revenue: 0,
      detail: "Något gick fel i steg 2"
    }
  }
  const steg2Time = performance.now() - steg2Start;
  const steg3Start = performance.now();
  // Försök göra steg 3
  try {
    const steg3Estimated = await (try_steg_3(input, weight_plus_one));

    // Om steg 3 gav null så fick vi ingen träff. Fortsätt med steg 4
    if (steg3Estimated !== null) {
      console.log("Steg 3 för kund", input.kundnamn, steg1Time, steg2Time, performance.now() - steg3Start);
      return {
        step_used: 3,
        estimated_revenue: steg3Estimated
      }
    }
  } catch (error) {
    console.error("Fel i steg 3. Felmeddelande:", error instanceof Error ? error.message : error);
    return {
      step_used: -1,
      estimated_revenue: 0,
      detail: "Något gick fel i steg 3"
    }
  }
  const steg3Time = performance.now() - steg3Start;
  const steg4Start = performance.now();
  // Försök göra steg 4
  try {
    const steg4Estimated = await try_steg_4(input, weight_plus_one);

    // Om steg 4 gav null så fick vi ingen träff. Fortsätt med steg 5
    if (steg4Estimated !== null) {
      console.log("Steg 4 för kund", input.kundnamn, steg1Time, steg2Time, steg3Time, performance.now() - steg4Start);
      return {
        step_used: 4,
        estimated_revenue: steg4Estimated
      }
    }
  } catch (error) {
    console.error("Fel i steg 4. Felmeddelande:", error instanceof Error ? error.message : error);
    return {
      step_used: -1,
      estimated_revenue: 0,
      detail: "Något gick fel i steg 4"
    }
  }
  const steg4Time = performance.now() - steg4Start;
  const steg5Start = performance.now();
  // Försök göra steg 5
  try {
    const steg5Estimated = await try_steg_5(input, weight_plus_one);

    // Om steg 5 gav null så fick vi ingen träff. Då har vi testat alla steg i modellen
    if (steg5Estimated !== null) {
      console.log("Steg 5 för kund", input.kundnamn, steg1Time, steg2Time, steg3Time, steg4Time, performance.now() - steg5Start);
      return {
        step_used: 5,
        estimated_revenue: steg5Estimated
      }
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
