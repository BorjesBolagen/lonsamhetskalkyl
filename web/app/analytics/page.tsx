"use client";

/**
 * Analys — vy över sparade nattprognoser (endast admin).
 *
 * Datan produceras av det nattliga cron-jobbet (/api/cron/daily-forecast) som
 * prognostiserar samtliga ekipage och sparar per datum. Här kan man:
 *   - välja datumintervall och ett eller flera ekipage,
 *   - se totaler (intäkt, vikt, flakmeter) per ekipage för perioden,
 *   - se linjegrafer med intäkt, vikt och flakmeter över tid,
 *   - ladda ner underlaget som Excel.
 */

import Navigation from "../../components/Navigation";
import Footer from "../../components/Footer";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  getCurrentlySignedInUser,
  getForecastAnalytics,
  getForecastEquipages,
  buildForecastExportUrl,
  type ForecastAnalyticsRow,
  type ForecastEquipageOption,
} from "@/lib/api";

// Kategorisk palett (validerad för CVD + kontrast mot appens ytor i båda
// teman). Färg följer ekipaget: en vald bil behåller sin färg när andra
// väljs bort. Max 8 serier ritas i graferna.
const MAX_CHART_SERIES = 8;

const SERIES_STYLE = `
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

const seriesColor = (slot: number) => `var(--series-${slot + 1})`;

const numberFormat = new Intl.NumberFormat("sv-SE", {
  maximumFractionDigits: 0,
});
const decimalFormat = new Intl.NumberFormat("sv-SE", {
  maximumFractionDigits: 1,
});

function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Prognoserna gäller 2 dagar bakåt, så senaste möjliga datum är idag - 2. */
function defaultToDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 2);
  return formatIsoDate(date);
}

function daysBefore(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() - days);
  return formatIsoDate(date);
}

type EquipageTotals = {
  id: number;
  name: string;
  days: number;
  consignments: number;
  weight: number;
  flm: number;
  revenue: number;
};

type Metric = "revenue" | "weight" | "flm";

const METRIC_CONFIG: Record<
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

type ChartPoint = { date: string } & Record<string, number | string>;

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

  return (
    <div
      className="rounded border border-[var(--seperating-gray)] bg-[var(--primary-element)] px-3 py-2 shadow-md"
      style={{ pointerEvents: "none" }}
    >
      <p className="mb-1 text-xs text-[var(--text-secondary)]">{label}</p>
      {payload.map((entry) => (
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
  series: { id: number; name: string; slot: number }[];
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

export default function Analytics() {
  const router = useRouter();

  const [isCheckingRole, setIsCheckingRole] = useState(true);

  const [toDate, setToDate] = useState(defaultToDate);
  const [fromDate, setFromDate] = useState(() => daysBefore(defaultToDate(), 29));

  const [equipages, setEquipages] = useState<ForecastEquipageOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [equipageSearch, setEquipageSearch] = useState("");

  const [rows, setRows] = useState<ForecastAnalyticsRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stabil färgtilldelning: valt ekipage behåller sin palettplats tills det
  // väljs bort, även när andra ekipage läggs till eller tas bort.
  const [colorSlots, setColorSlots] = useState<Map<number, number>>(
    () => new Map(),
  );

  // Endast admin får se sidan (API:erna kräver också admin).
  useEffect(() => {
    let cancelled = false;

    getCurrentlySignedInUser()
      .then((response) => {
        if (cancelled) return;
        if (!response.status || response.data?.role !== "admin") {
          router.replace("/home");
          return;
        }
        setIsCheckingRole(false);
      })
      .catch(() => {
        if (!cancelled) router.replace("/login");
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  // Ekipagelistan (från sparad prognosdata).
  useEffect(() => {
    if (isCheckingRole) return;

    getForecastEquipages()
      .then((response) => setEquipages(response.data ?? []))
      .catch(() =>
        setError("Kunde inte hämta ekipagelistan från prognosdatabasen."),
      );
  }, [isCheckingRole]);

  // Prognosrader för valt intervall. Ekipagefiltret appliceras client-side
  // så att val/avval av bilar är omedelbart.
  useEffect(() => {
    if (isCheckingRole || !fromDate || !toDate || fromDate > toDate) return;

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    setError(null);

    getForecastAnalytics(fromDate, toDate)
      .then((response) => {
        if (cancelled) return;
        setRows(response.data ?? []);
      })
      .catch((fetchError) => {
        if (cancelled) return;
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Kunde inte hämta prognosdata.",
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isCheckingRole, fromDate, toDate]);

  const toggleEquipage = (id: number) => {
    const nextIds = new Set(selectedIds);
    const nextSlots = new Map(colorSlots);

    if (nextIds.has(id)) {
      nextIds.delete(id);
      nextSlots.delete(id);
    } else {
      nextIds.add(id);
      // Lägsta lediga palettplats.
      const used = new Set(nextSlots.values());
      let slot = 0;
      while (used.has(slot)) slot++;
      nextSlots.set(id, slot);
    }

    setSelectedIds(nextIds);
    setColorSlots(nextSlots);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setColorSlots(new Map());
  };

  const visibleEquipages = useMemo(() => {
    const query = equipageSearch.trim().toLowerCase();
    if (!query) return equipages;
    return equipages.filter((equipage) =>
      equipage.name.toLowerCase().includes(query),
    );
  }, [equipages, equipageSearch]);

  const selectedRows = useMemo(
    () => rows.filter((row) => selectedIds.has(row.equipage_id)),
    [rows, selectedIds],
  );

  // Totaler per valt ekipage över perioden.
  const totalsPerEquipage = useMemo<EquipageTotals[]>(() => {
    const byId = new Map<number, EquipageTotals>();

    for (const row of selectedRows) {
      const existing = byId.get(row.equipage_id) ?? {
        id: row.equipage_id,
        name: row.equipage_name,
        days: 0,
        consignments: 0,
        weight: 0,
        flm: 0,
        revenue: 0,
      };

      existing.days += 1;
      existing.consignments += row.consignment_count;
      existing.weight += Number(row.total_weight_kg);
      existing.flm += Number(row.total_flm);
      existing.revenue += Number(row.total_estimated_revenue);
      byId.set(row.equipage_id, existing);
    }

    return Array.from(byId.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "sv"),
    );
  }, [selectedRows]);

  // Serier för graferna (max 8, i palettplats-ordning).
  const chartSeries = useMemo(() => {
    return Array.from(selectedIds)
      .map((id) => ({
        id,
        name:
          equipages.find((equipage) => equipage.id === id)?.name ?? String(id),
        slot: colorSlots.get(id) ?? 0,
      }))
      .filter((entry) => entry.slot < MAX_CHART_SERIES)
      .sort((a, b) => a.slot - b.slot);
  }, [selectedIds, colorSlots, equipages]);

  // En punkt per datum, med ett fält per valt ekipage och mätvärde.
  const chartPoints = useMemo<Record<Metric, ChartPoint[]>>(() => {
    const dates = Array.from(
      new Set(selectedRows.map((row) => row.forecast_date)),
    ).sort();

    const build = (field: keyof ForecastAnalyticsRow): ChartPoint[] =>
      dates.map((date) => {
        const point: ChartPoint = { date };
        for (const row of selectedRows) {
          if (row.forecast_date === date) {
            point[`eq_${row.equipage_id}`] = Number(row[field]);
          }
        }
        return point;
      });

    return {
      revenue: build("total_estimated_revenue"),
      weight: build("total_weight_kg"),
      flm: build("total_flm"),
    };
  }, [selectedRows]);

  const exportUrl = buildForecastExportUrl(
    fromDate,
    toDate,
    selectedIds.size > 0 ? Array.from(selectedIds) : undefined,
  );

  const hasValidRange = Boolean(fromDate && toDate && fromDate <= toDate);
  const hiddenSeriesCount = selectedIds.size - chartSeries.length;

  if (isCheckingRole) {
    return (
      <div className="min-h-screen bg-[var(--bg)]">
        <Navigation currentPage="analytics" />
        <main className="mx-auto max-w-7xl p-6">
          <p className="text-[var(--text-secondary)]">Laddar...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="analytics-viz min-h-screen bg-[var(--bg)] text-[var(--text-primary)]">
      <style>{SERIES_STYLE}</style>
      <Navigation currentPage="analytics" />

      <main className="mx-auto max-w-7xl p-6">
        <h1 className="mb-1 text-3xl font-bold text-[var(--text-heading)]">
          Analys
        </h1>
        <p className="mb-6 text-[var(--text-secondary)]">
          Nattligt sparade prognoser per ekipage: intäkt, vikt och flakmeter.
        </p>

        {/* Filterrad: datumintervall + export */}
        <div className="mb-6 flex flex-wrap items-end gap-4 rounded-lg bg-[var(--primary-element)] p-4 shadow-md">
          <div>
            <label
              htmlFor="analytics-from"
              className="mb-1 block text-sm font-bold"
            >
              Från
            </label>
            <input
              id="analytics-from"
              type="date"
              value={fromDate}
              max={toDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="rounded border-2 border-[var(--seperating-gray)] bg-[var(--input-text)] p-2"
            />
          </div>

          <div>
            <label
              htmlFor="analytics-to"
              className="mb-1 block text-sm font-bold"
            >
              Till
            </label>
            <input
              id="analytics-to"
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="rounded border-2 border-[var(--seperating-gray)] bg-[var(--input-text)] p-2"
            />
          </div>

          <div className="flex gap-2">
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => {
                  const to = defaultToDate();
                  setToDate(to);
                  setFromDate(daysBefore(to, days - 1));
                }}
                className="rounded border border-[var(--seperating-gray)] px-3 py-2 text-sm hover:bg-[var(--hover-areas)]"
              >
                {days} dagar
              </button>
            ))}
          </div>

          <div className="ml-auto">
            <a
              href={hasValidRange ? exportUrl : undefined}
              aria-disabled={!hasValidRange}
              className={`inline-block rounded px-4 py-2 font-bold text-white shadow-md ${
                hasValidRange
                  ? "bg-[var(--button-fetch)] hover:bg-[var(--button-fetch-hover)]"
                  : "pointer-events-none bg-[var(--disabled-button)]"
              }`}
            >
              Ladda ner Excel
            </a>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              {selectedIds.size > 0
                ? "Exporterar valda ekipage för perioden"
                : "Exporterar alla ekipage för perioden"}
            </p>
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded bg-[var(--primary-element)] p-3 font-bold text-[var(--error)] shadow-md">
            {error}
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Ekipageval */}
          <aside className="self-start rounded-lg bg-[var(--primary-element)] p-4 shadow-md">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-bold text-lg text-[var(--text-heading)]">
                Ekipage
              </h2>
              {selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-sm text-[var(--text-secondary)] underline hover:text-[var(--text-heading)]"
                >
                  Rensa ({selectedIds.size})
                </button>
              )}
            </div>

            <input
              type="text"
              value={equipageSearch}
              onChange={(event) => setEquipageSearch(event.target.value)}
              placeholder="Sök ekipage..."
              className="mb-3 w-full rounded border-2 border-[var(--seperating-gray)] bg-[var(--input-text)] p-2"
            />

            <div className="max-h-[420px] space-y-1 overflow-y-auto">
              {visibleEquipages.map((equipage) => {
                const isSelected = selectedIds.has(equipage.id);
                const slot = colorSlots.get(equipage.id);
                return (
                  <label
                    key={equipage.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-[var(--hover-areas)]"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleEquipage(equipage.id)}
                      className="h-4 w-4"
                    />
                    <span className="flex-1">{equipage.name}</span>
                    {isSelected && slot !== undefined && slot < MAX_CHART_SERIES && (
                      <span
                        aria-hidden
                        style={{
                          display: "inline-block",
                          width: 14,
                          height: 0,
                          borderTop: `2px solid ${seriesColor(slot)}`,
                        }}
                      />
                    )}
                  </label>
                );
              })}
              {equipages.length === 0 && (
                <p className="text-sm text-[var(--text-secondary)]">
                  Ingen prognosdata sparad ännu. Data fylls på av det nattliga
                  jobbet.
                </p>
              )}
              {equipages.length > 0 && visibleEquipages.length === 0 && (
                <p className="text-sm text-[var(--text-secondary)]">
                  Inga ekipage matchar sökningen.
                </p>
              )}
            </div>
          </aside>

          {/* Resultat */}
          <section className="space-y-6" style={{ opacity: isLoading ? 0.6 : 1 }}>
            {selectedIds.size === 0 ? (
              <div className="rounded-lg bg-[var(--primary-element)] p-8 text-center shadow-md">
                <p className="text-[var(--text-secondary)]">
                  Välj ett eller flera ekipage i listan för att se totaler och
                  grafer för perioden.
                </p>
              </div>
            ) : (
              <>
                {/* Tabell med totaler per ekipage */}
                <div className="overflow-x-auto rounded-lg bg-[var(--primary-element)] p-4 shadow-md">
                  <h2 className="mb-3 font-bold text-lg text-[var(--text-heading)]">
                    Totaler {fromDate} – {toDate}
                  </h2>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b-2 border-[var(--seperating-gray)] text-[var(--text-secondary)]">
                        <th className="py-2 pr-4">Ekipage</th>
                        <th className="py-2 pr-4 text-right">Dagar med data</th>
                        <th className="py-2 pr-4 text-right">Bokningar</th>
                        <th className="py-2 pr-4 text-right">Vikt (kg)</th>
                        <th className="py-2 pr-4 text-right">Flakmeter</th>
                        <th className="py-2 text-right">Intäkt (SEK)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {totalsPerEquipage.map((totals) => (
                        <tr
                          key={totals.id}
                          className="border-b border-[var(--seperating-gray)]"
                        >
                          <td className="py-2 pr-4 font-bold">{totals.name}</td>
                          <td className="py-2 pr-4 text-right tabular-nums">
                            {totals.days}
                          </td>
                          <td className="py-2 pr-4 text-right tabular-nums">
                            {numberFormat.format(totals.consignments)}
                          </td>
                          <td className="py-2 pr-4 text-right tabular-nums">
                            {numberFormat.format(totals.weight)}
                          </td>
                          <td className="py-2 pr-4 text-right tabular-nums">
                            {decimalFormat.format(totals.flm)}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {numberFormat.format(totals.revenue)}
                          </td>
                        </tr>
                      ))}
                      {totalsPerEquipage.length > 1 && (
                        <tr className="font-bold">
                          <td className="py-2 pr-4">Totalt</td>
                          <td className="py-2 pr-4 text-right tabular-nums">
                            {totalsPerEquipage.reduce((sum, t) => sum + t.days, 0)}
                          </td>
                          <td className="py-2 pr-4 text-right tabular-nums">
                            {numberFormat.format(
                              totalsPerEquipage.reduce(
                                (sum, t) => sum + t.consignments,
                                0,
                              ),
                            )}
                          </td>
                          <td className="py-2 pr-4 text-right tabular-nums">
                            {numberFormat.format(
                              totalsPerEquipage.reduce((sum, t) => sum + t.weight, 0),
                            )}
                          </td>
                          <td className="py-2 pr-4 text-right tabular-nums">
                            {decimalFormat.format(
                              totalsPerEquipage.reduce((sum, t) => sum + t.flm, 0),
                            )}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {numberFormat.format(
                              totalsPerEquipage.reduce(
                                (sum, t) => sum + t.revenue,
                                0,
                              ),
                            )}
                          </td>
                        </tr>
                      )}
                      {totalsPerEquipage.length === 0 && !isLoading && (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-4 text-center text-[var(--text-secondary)]"
                          >
                            Ingen prognosdata för valda ekipage i perioden.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {hiddenSeriesCount > 0 && (
                  <p className="text-sm text-[var(--text-secondary)]">
                    Graferna visar de {MAX_CHART_SERIES} först valda ekipagen.
                    Ytterligare {hiddenSeriesCount} valda ingår i tabellen och
                    Excel-exporten.
                  </p>
                )}

                {chartSeries.length > 0 && chartPoints.revenue.length > 0 && (
                  <>
                    <MetricChartCard
                      metric="revenue"
                      points={chartPoints.revenue}
                      series={chartSeries}
                    />
                    <MetricChartCard
                      metric="flm"
                      points={chartPoints.flm}
                      series={chartSeries}
                    />
                    <MetricChartCard
                      metric="weight"
                      points={chartPoints.weight}
                      series={chartSeries}
                    />
                  </>
                )}
              </>
            )}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
