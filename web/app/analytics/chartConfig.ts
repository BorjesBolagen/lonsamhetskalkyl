/**
 * Delad graf- och formateringskonfiguration för Analys-fliken.
 *
 * Ligger i egen modul så att sidan kan använda paletten och formaten utan att
 * dra in recharts — grafkortet (MetricChartCard) laddas separat och lazy.
 */

import type { ForecastAnalyticsRow } from "@/lib/api";

// Kategorisk palett (validerad för CVD + kontrast mot appens ytor i båda
// teman). Färg följer ekipaget: en vald bil behåller sin färg när andra
// väljs bort. Max 8 serier ritas i graferna.
export const MAX_CHART_SERIES = 8;

export const SERIES_STYLE = `
  .analytics-viz {
    --series-1: #2a78d6;
    --series-2: #1baf7a;
    --series-3: #eda100;
    --series-4: #008300;
    --series-5: #4a3aa7;
    --series-6: #e34948;
    --series-7: #e87ba4;
    --series-8: #eb6834;
  }
  html[data-theme="dark"] .analytics-viz {
    --series-1: #3987e5;
    --series-2: #199e70;
    --series-3: #c98500;
    --series-4: #008300;
    --series-5: #9085e9;
    --series-6: #e66767;
    --series-7: #d55181;
    --series-8: #d95926;
  }
`;

export const seriesColor = (slot: number) => `var(--series-${slot + 1})`;

export const numberFormat = new Intl.NumberFormat("sv-SE", {
  maximumFractionDigits: 0,
});
export const decimalFormat = new Intl.NumberFormat("sv-SE", {
  maximumFractionDigits: 1,
});

export type Metric = "revenue" | "weight" | "flm";

export const METRIC_CONFIG: Record<
  Metric,
  { title: string; unit: string; field: keyof ForecastAnalyticsRow }
> = {
  revenue: {
    title: "Prognostiserad intäkt",
    unit: "SEK",
    field: "total_estimated_revenue",
  },
  weight: { title: "Vikt", unit: "kg", field: "total_weight_kg" },
  flm: { title: "Flakmeter", unit: "flm", field: "total_flm" },
};

export type ChartPoint = { date: string } & Record<string, number | string>;

export type ChartSeries = { id: number; name: string; slot: number };

/**
 * Ger varje nytt id lägsta lediga palettplats. Redan tilldelade id behåller
 * sin plats, så en vald bil byter inte färg när andra läggs till eller tas
 * bort.
 */
export function assignColorSlots(
  current: Map<number, number>,
  ids: number[],
): Map<number, number> {
  const next = new Map(current);
  const used = new Set(next.values());

  for (const id of ids) {
    if (next.has(id)) continue;

    let slot = 0;
    while (used.has(slot)) slot++;

    next.set(id, slot);
    used.add(slot);
  }

  return next;
}
