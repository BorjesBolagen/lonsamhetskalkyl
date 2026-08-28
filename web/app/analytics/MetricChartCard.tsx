"use client";

/**
 * Grafkort för Analys-fliken: en linjegraf per mätvärde.
 *
 * Egen modul eftersom recharts är sidans tyngsta beroende (~100 KB gzip).
 * page.tsx laddar kortet med next/dynamic, så filterraden, ekipagelistan och
 * totaltabellen blir interaktiva innan grafkoden hämtats.
 */

import { memo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  METRIC_CONFIG,
  decimalFormat,
  numberFormat,
  seriesColor,
  type ChartPoint,
  type ChartSeries,
  type Metric,
} from "./chartConfig";

type TooltipEntry = {
  dataKey?: string | number;
  value?: number | string;
  color?: string;
  name?: string | number;
};

/** Egen tooltip: värdet först (fetstil), serienamn sekundärt, linjenyckel i seriefärg. */
function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  unit: string;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const sortedPayload = [...payload].sort((a, b) => {
    const aValue = Number(a.value ?? 0);
    const bValue = Number(b.value ?? 0);
    return bValue - aValue;
  });

  return (
    <div
      className="rounded border border-[var(--seperating-gray)] bg-[var(--primary-element)] px-3 py-2 shadow-md"
      style={{ pointerEvents: "none" }}
    >
      <p className="mb-1 text-xs text-[var(--text-secondary)]">{label}</p>
      {sortedPayload.map((entry) => (
        <p key={String(entry.dataKey)} className="flex items-center gap-2 text-sm">
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: 12,
              height: 0,
              borderTop: `2px solid ${entry.color}`,
            }}
          />
          <span className="font-bold text-[var(--text-heading)]">
            {decimalFormat.format(Number(entry.value ?? 0))} {unit}
          </span>
          <span className="text-[var(--text-secondary)]">{entry.name}</span>
        </p>
      ))}
    </div>
  );
}

function MetricChartCard({
  metric,
  points,
  series,
}: {
  metric: Metric;
  points: ChartPoint[];
  series: ChartSeries[];
}) {
  const config = METRIC_CONFIG[metric];

  return (
    <div className="rounded-lg bg-[var(--primary-element)] p-4 shadow-md">
      <h3 className="font-bold text-lg text-[var(--text-heading)]">
        {config.title}{" "}
        <span className="text-sm font-normal text-[var(--text-secondary)]">
          ({config.unit})
        </span>
      </h3>

      {series.length === 1 ? (
        <p className="mb-2 text-sm text-[var(--text-secondary)]">
          {series[0].name}
        </p>
      ) : (
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
          {series.map((entry) => (
            <span
              key={entry.id}
              className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]"
            >
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  width: 14,
                  height: 0,
                  borderTop: `2px solid ${seriesColor(entry.slot)}`,
                }}
              />
              {entry.name}
            </span>
          ))}
        </div>
      )}

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
            <CartesianGrid
              stroke="var(--seperating-gray)"
              strokeWidth={1}
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: "var(--seperating-gray)" }}
            />
            <YAxis
              domain={[0, "auto"]}
              tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) => numberFormat.format(value)}
              width={72}
            />
            <Tooltip
              content={<ChartTooltip unit={config.unit} />}
              cursor={{ stroke: "var(--text-secondary)", strokeWidth: 1 }}
            />
            {series.map((entry) => (
              <Line
                key={entry.id}
                type="monotone"
                dataKey={`eq_${entry.id}`}
                name={entry.name}
                stroke={seriesColor(entry.slot)}
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 4,
                  stroke: "var(--primary-element)",
                  strokeWidth: 2,
                }}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * memo: sidan renderar om vid varje tangenttryck i ekipagesökningen. Utan
 * memo renderas alla tre graferna om trots att points/series är oförändrade.
 */
export default memo(MetricChartCard);
