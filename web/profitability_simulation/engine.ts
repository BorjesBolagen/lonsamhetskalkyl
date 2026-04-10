import type { MedelseRow } from "./types";

export function normalizeText(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

export function normalizeCode(value: string): string {
  return value.replace(/\D/g, "");
}

export function buildTaxeprel(start: string, slut: string): string {
  return `${start}-${slut}`;
}

export function average(values: number[]): number {
  if (values.length === 0) {
    throw new Error("Kan inte ta medelvärde av tom lista.");
  }
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function getVklfgrv(weight: number): number {
  const thresholds: Array<[number, number]> = [
    [1, 1],
    [10, 2],
    [20, 3],
    [30, 4],
    [40, 5],
    [60, 6],
    [80, 7],
    [100, 8],
    [150, 9],
    [200, 10],
    [250, 11],
    [300, 12],
    [350, 13],
    [400, 14],
    [450, 15],
    [500, 16],
    [600, 17],
    [700, 18],
    [800, 19],
    [900, 20],
    [1000, 21],
    [2500, 22],
    [5000, 23],
    [7000, 24],
    [10000, 25],
    [15000, 26],
    [21000, 27],
    [28000, 28],
  ];

  if (weight < 1) {
    throw new Error("chargeable_weight måste vara minst 1.");
  }

  let selected = 1;
  for (const [minWeight, vkl] of thresholds) {
    if (weight >= minWeight) {
      selected = vkl;
    } else {
      break;
    }
  }

  return selected;
}

export function chooseKmBucket(
  km: number,
  medelseRows: MedelseRow[],
  vklfgrv: number
): number {
  const buckets = [...new Set(
    medelseRows
      .filter((row) => row.vklfgrv === vklfgrv)
      .map((row) => row.km_bucket)
  )].sort((a, b) => a - b);

  if (buckets.length === 0) {
    throw new Error(`Inga km-buckets hittades för vklfgrv=${vklfgrv}.`);
  }

  if (buckets.includes(km)) {
    return km;
  }

  for (const bucket of buckets) {
    if (km <= bucket) {
      return bucket;
    }
  }

  return buckets[buckets.length - 1];
}