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
import { useEffect, useMemo, useRef, useState } from "react";
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
import { TriangleAlert } from "lucide-react";

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
  const [isForecastModalOpen, setIsForecastModalOpen] = useState(false);
  const [forecastDate, setForecastDate] = useState(defaultToDate);
  const [forecastLogs, setForecastLogs] = useState<ForecastLogEntry[]>([]);
  const [isForecastRunning, setIsForecastRunning] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const logBottomRef = useRef<HTMLDivElement | null>(null);

  type ForecastLogEntry = {
    message: string;
    color: "green" | "yellow" | "red" | "gray";
  };

  const logColorClass: Record<ForecastLogEntry["color"], string> = {
    green: "text-green-400",
    yellow: "text-yellow-300",
    red: "text-red-400",
    gray: "text-gray-400",
  };

  const appendForecastLog = (entry: ForecastLogEntry) => {
    setForecastLogs((current) => [...current, entry]);
  };

  const closeForecastModal = () => {
    setIsForecastRunning(false);
    setIsForecastModalOpen(false);
    setForecastLogs([]);
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };

  const startManualForecast = () => {
    if (isForecastRunning) return;
    setForecastLogs([]);
    setIsForecastRunning(true);

    const url = `/api/cron/manual-daily-forecast-stream?date=${encodeURIComponent(
      forecastDate,
    )}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "log") {
          appendForecastLog({
            message: payload.message,
            color: payload.color ?? "green",
          });
        } else if (payload.type === "done") {
          appendForecastLog({ message: "Prognos klar. Klicka på Hämta data för att läsa in nya datan", color: "yellow" });
          setIsForecastRunning(false);
          eventSource.close();
          eventSourceRef.current = null;
        } else if (payload.type === "error") {
          appendForecastLog({ message: `Fel: ${payload.message}`, color: "red" });
          setIsForecastRunning(false);
          eventSource.close();
          eventSourceRef.current = null;
        }
      } catch (parseError) {
        appendForecastLog({
          message: `Ogiltigt SSE-meddelande: ${event.data}`,
          color: "red",
        });
      }
    };

    eventSource.onerror = () => {
      appendForecastLog({
        message: "Stream-fel. Kontrollera att du är inloggad som admin.",
        color: "red",
      });
      setIsForecastRunning(false);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  };

  useEffect(() => {
    if (forecastLogs.length === 0 || !logBottomRef.current) return;
    logBottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [forecastLogs]);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

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

  const refreshForecastData = () => {
    if (isCheckingRole) return;

    getForecastEquipages()
      .then((response) => {
        setEquipages(response.data ?? []);
        setError(null);
      })
      .catch(() => {
        setEquipages([]);
        setError("Kunde inte hämta ekipage.");
      });

    if (!fromDate || !toDate || fromDate > toDate) return;

    setIsLoading(true);
    setError(null);

    getForecastAnalytics(fromDate, toDate)
      .then((response) => {
        setRows(response.data ?? []);
        setError(null);
      })
      .catch(() => {
        setRows([]);
        setError("Kunde inte hämta prognosdata för valt intervall.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  // Ekipagelistan (från sparad prognosdata).
  useEffect(() => {
    if (isCheckingRole) return;
    refreshForecastData();
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
        <div className="mb-6 flex items-start justify-between gap-6 rounded-lg bg-[var(--primary-element)] p-4 shadow-md">
          {/* Vänster sida: datum + snabbval */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label
                  htmlFor="analytics-from"
                  className="mb-1 block text-sm font-bold"
                >
                  Från och med
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
                  Till och med
                </label>
                <input
                  id="analytics-to"
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                  className="rounded border-2 border-[var(--seperating-gray)] bg-[var(--input-text)] p-2"
                />
              </div>
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
          </div>

          {/* Höger sida: åtgärdsknappar */}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={refreshForecastData}
              disabled={isLoading}
              className={`rounded px-4 py-2 font-bold text-white shadow-md ${
                isLoading
                  ? "cursor-not-allowed bg-[var(--disabled-button)]"
                  : "bg-[var(--button-fetch)] hover:bg-[var(--button-fetch-hover)]"
              }`}
            >
              {isLoading ? "Hämtar..." : "Hämta data"}
            </button>
            <button
              type="button"
              onClick={() => setIsForecastModalOpen(true)}
              className="rounded bg-[var(--button-fetch)] px-4 py-2 font-bold text-white shadow-md hover:bg-[var(--button-fetch-hover)]"
            >
              Kör prognos manuellt
            </button>
            <a
              href={hasValidRange ? exportUrl : undefined}
              aria-disabled={!hasValidRange}
              title={
                hasValidRange
                  ? "Exportera vald period som Excel-fil. Om inga ekipage är valda exporteras alla."
                  : "Välj ett giltigt datumintervall för att exportera"
              }
              className={`inline-block rounded px-4 py-2 font-bold text-white shadow-md text-center ${
                hasValidRange
                  ? "bg-[var(--button-fetch)] hover:bg-[var(--button-fetch-hover)]"
                  : "pointer-events-none bg-[var(--disabled-button)]"
              }`}
            >
              Exportera som Excel
            </a>
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded bg-[var(--primary-element)] p-3 font-bold text-[var(--error)] shadow-md">
            {error}
          </p>
        )}

        {isForecastModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-xl bg-[var(--primary-element)] shadow-2xl">
              <div className="flex items-center justify-between border-b border-[var(--seperating-gray)] px-4 py-3">
                <div>
                  <h2 className="mb-3 mt-2 ml-2 text-lg font-bold text-[var(--text-heading)]">
                    Manuell prognos
                  </h2>
                  <div
                    className="mb-4 ml-2 flex items-center gap-2 rounded p-4 text-sm text-yellow-800 bg-yellow-100 border-2 border-yellow-300"
                    role="alert"
                  >
                    <TriangleAlert className="h-5 w-5 flex-shrink-0 text-yellow-800" />
                    <div>
                      <span className="font-bold">Varning!</span> Detta belastar prognosberäkningen och iLog. Kan ta några minuter.
                      <br />
                      <span className="font-bold">OBS!</span> Rekommenderat att köras när systemet är minst belastat.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeForecastModal}
                  className="rounded bg-[var(--disabled-button)] px-3 py-2 text-sm font-bold"
                >
                  Stäng
                </button>
              </div>

              <div className="space-y-4 p-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <label className="flex flex-col gap-1 text-sm font-bold text-[var(--text-secondary)]">
                    Datum
                    <input
                      type="date"
                      value={forecastDate}
                      onChange={(event) => setForecastDate(event.target.value)}
                      className="rounded border border-[var(--seperating-gray)] bg-[var(--input-text)] p-2"
                      max={defaultToDate()}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={startManualForecast}
                    disabled={isForecastRunning}
                    className={`rounded px-4 py-2 font-bold text-white shadow-md ${
                      isForecastRunning
                        ? "bg-[var(--disabled-button)] cursor-not-allowed"
                        : "bg-[var(--button-fetch)] hover:bg-[var(--button-fetch-hover)]"
                    }`}
                  >
                    {isForecastRunning ? "Körs…" : "Starta prognos"}
                  </button>
                </div>

                <div className="rounded border border-[var(--seperating-gray)] bg-[var(--input-text)] p-3 text-sm text-[var(--text-secondary)]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-[var(--text-heading)]">Logg</span>
                    <div className="flex gap-2">
                      {isForecastRunning && (
                        <button
                          type="button"
                          onClick={() => {
                            eventSourceRef.current?.close();
                            eventSourceRef.current = null;
                            setIsForecastRunning(false);
                            appendForecastLog({
                              message: "Avbröt prognoskörning.",
                              color: "yellow",
                            });
                          }}
                          className="px-3 py-1 text-m text-[var(--text-secondary)] hover:text-black cursor-pointer bg-orange-400 rounded-lg"
                        >
                          Avbryt
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setForecastLogs([])}
                        className="px-3 py-1 text-m text-[var(--text-secondary)] hover:text-black cursor-pointer bg-red-400 rounded-lg"
                      >
                        Rensa
                      </button>
                    </div>
                  </div>
                  <div className="w-full h-60 overflow-y-auto rounded-lg bg-gray-900 text-sm font-mono p-3 flex flex-col gap-1">
                    {forecastLogs.length === 0 ? (
                      <span className="text-gray-500">Väntar...</span>
                    ) : (
                      forecastLogs.map((log, index) => (
                        <span
                          key={index}
                          className={`whitespace-pre ${logColorClass[log.color]}`}
                        >
                          {log.message}
                        </span>
                      ))
                    )}
                    <div ref={logBottomRef} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Ekipageval */}
          <aside className="self-start rounded-lg bg-[var(--primary-element)] p-4 shadow-md">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="font-bold text-lg text-[var(--text-heading)]">
                Ekipage
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                {visibleEquipages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const nextIds = new Set(selectedIds);
                      visibleEquipages.forEach((equipage) => nextIds.add(equipage.id));
                      setSelectedIds(nextIds);
                    }}
                    className="text-sm text-[var(--text-secondary)] underline hover:text-[var(--text-heading)]"
                  >
                    Välj alla
                  </button>
                )}
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
