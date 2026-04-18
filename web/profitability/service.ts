import "server-only";

import {
  average,
  buildTaxeprelFromRelation,
  chooseKmBucket,
  getVklfgrv,
  normalizeText,
} from "./engine";
import {
  fetchCustomerRows,
  fetchCustomerVklRows,
  fetchExactTrappstegRow,
  fetchKmByTaxeprel,
  fetchMedelseRowsByVkl,
} from "./repository";
import type { ProfitabilityInput, ProfitabilityResult } from "./types";
import { try_steg_1 } from "./trappsteg_steg";

export async function calculateProfitability(
  input: ProfitabilityInput
): Promise<ProfitabilityResult> {
  const kundnamn = normalizeText(input.kundnamn);
  const taxPointRelation = input.taxPointRelation?.trim();
  const weight = Number(input.chargeable_weight);
  // Kanse ta med linnje också
  
  if (!kundnamn) {
    throw new Error("Kundnamn måste fyllas i.");
  }

  if (!taxPointRelation) {
    throw new Error("taxPointRelation måste fyllas i.");
  }

  if (!Number.isFinite(weight) || weight <= 0) {
    throw new Error("Fraktgrundande vikt måste vara ett giltigt tal större än 0.");
  }

  // Försök göra steg 1.
  try {
    const steg1Estimated = await try_steg_1(input);

    // Om steg 1 gav null så fick vi ingen träff. Fortsätt med steg 2
    if (steg1Estimated !== null) {
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
    }
  }

  // Gammalt steg 1
  const vklfgrv = getVklfgrv(weight);
  const taxeprel = buildTaxeprelFromRelation(taxPointRelation);

  // steg 2 och fram
  const km = await fetchKmByTaxeprel(taxeprel);
  if (km === null || !Number.isFinite(km)) {
    throw new Error(
      `Ingen distans hittades i distance_map för taxeprel='${taxeprel}'.`
    );
  }

  const medelseRows = await fetchMedelseRowsByVkl(vklfgrv);
  const kmBucket = chooseKmBucket(km, medelseRows, vklfgrv);

  const medelseRow = medelseRows.find(
    (row) => Number(row.km_bucket) === Number(kmBucket)
  );

  if (!medelseRow) {
    throw new Error(
      `Ingen MedelSE-rad hittades för km_bucket='${kmBucket}', vklfgrv='${vklfgrv}'.`
    );
  }

  const medelseValue = Number(medelseRow.kndnto_medelse);

  const customerVklRows = await fetchCustomerVklRows(kundnamn, vklfgrv);
  const step2Factors = customerVklRows
    .map((row) => Number(row.forh_se_radvis ?? 0))
    .filter((value) => value > 0);

  if (step2Factors.length > 0) {
    const factor = average(step2Factors);

    return {
      step_used: 2,
      estimated_revenue: medelseValue * factor * weight,
    };
  }

  const customerRows = await fetchCustomerRows(kundnamn);
  const step3Factors = customerRows
    .map((row) => Number(row.forh_se_kundvis ?? 0))
    .filter((value) => value > 0);

  if (step3Factors.length > 0) {
    const factor = average(step3Factors);

    return {
      step_used: 3,
      estimated_revenue: medelseValue * factor * weight,
    };
  }

  throw new Error(
    `Ingen träff i steg 1-3 för kundnamn='${kundnamn}', taxeprel='${taxeprel}', vklfgrv='${vklfgrv}'.`
  );
}