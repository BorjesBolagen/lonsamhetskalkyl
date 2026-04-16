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

export async function calculateProfitability(
  input: ProfitabilityInput
): Promise<ProfitabilityResult> {
  const kundnamn = normalizeText(input.kundnamn);
  const taxPointRelation = input.taxPointRelation?.trim();
  const weight = Number(input.chargeable_weight);

  if (!kundnamn) {
    throw new Error("Kundnamn måste fyllas i.");
  }

  if (!taxPointRelation) {
    throw new Error("taxPointRelation måste fyllas i.");
  }

  if (!Number.isFinite(weight) || weight <= 0) {
    throw new Error("Fraktgrundande vikt måste vara ett giltigt tal större än 0.");
  }

  const vklfgrv = getVklfgrv(weight);
  const taxeprel = buildTaxeprelFromRelation(taxPointRelation);

  const exactRow = await fetchExactTrappstegRow(kundnamn, taxeprel, vklfgrv);

  console.log("step1 lookup", {
    kundnamn,
    taxeprel,
    vklfgrv,
    exactRow,
  });

  if (exactRow && (exactRow.kndntofgrv ?? 0) > 0) {
    console.log("step1 used", {
      kundnamn,
      taxeprel,
      vklfgrv,
      kndntofgrv: exactRow.kndntofgrv,
    });

    return {
      step_used: 1,
      taxeprel,
      vklfgrv,
      estimated_revenue: Number(exactRow.kndntofgrv) * weight,
      explanation: "Steg 1: exakt träff på kundnamn + taxeprel + vklfgrv.",
    };
  }

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
      taxeprel,
      vklfgrv,
      estimated_revenue: medelseValue * factor * weight,
      explanation: "Steg 2: fallback på kundnamn + vklfgrv.",
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
      taxeprel,
      vklfgrv,
      estimated_revenue: medelseValue * factor * weight,
      explanation: "Steg 3: fallback på endast kundnamn.",
    };
  }

  throw new Error(
    `Ingen träff i steg 1-3 för kundnamn='${kundnamn}', taxeprel='${taxeprel}', vklfgrv='${vklfgrv}'.`
  );
}