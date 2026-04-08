import "server-only";

import {
  average,
  buildTaxeprel,
  chooseKmBucket,
  getVklfgrv,
  normalizeCode,
  normalizeText,
} from "./engine";
import {
  fetchCustomerRows,
  fetchCustomerVklRows,
  fetchExactTrappstegRow,
  fetchKmByTaxeprel,
  fetchMedelseRowsByVkl,
} from "./repository";
import type {
  SimulationProfitabilityInput,
  SimulationProfitabilityResult,
} from "./types";

export async function calculateSimulationProfitability(
  input: SimulationProfitabilityInput
): Promise<SimulationProfitabilityResult> {
  const kundnamn = normalizeText(input.kundnamn);
  const start = normalizeCode(input.start);
  const slut = normalizeCode(input.slut);
  const weight = Number(input.chargeable_weight);

  if (!kundnamn) {
    throw new Error("Kundnamn måste fyllas i.");
  }

  if (!start) {
    throw new Error("Start måste fyllas i.");
  }

  if (!slut) {
    throw new Error("Slut måste fyllas i.");
  }

  if (!Number.isFinite(weight) || weight <= 0) {
    throw new Error("Fraktgrundande vikt måste vara ett giltigt tal större än 0.");
  }

  const vklfgrv = getVklfgrv(weight);
  const taxeprel = buildTaxeprel(start, slut);

  // Steg 1: exakt träff
  const exactRow = await fetchExactTrappstegRow(kundnamn, taxeprel, vklfgrv);
  if (exactRow && (exactRow.kndntofgrv ?? 0) > 0) {
    return {
      step_used: 1,
      taxeprel,
      vklfgrv,
      estimated_revenue: Number(exactRow.kndntofgrv) * weight,
      explanation: "Steg 1: exakt träff på kundnamn + taxeprel + vklfgrv.",
    };
  }

  // Gemensam bas för steg 2 och 3
  const km = await fetchKmByTaxeprel(taxeprel);
  if (km === null || !Number.isFinite(km)) {
    throw new Error(`Inget km-värde hittades för taxeprel='${taxeprel}'.`);
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

  // Steg 2: kundnamn + vklfgrv
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

  // Steg 3: endast kundnamn
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