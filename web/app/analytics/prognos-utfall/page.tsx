"use client";

/**
 * Prognos jämfört med utfall — månadsvis jämförelse per regnr (endast admin).
 *
 * Prognosen är de nattligt sparade intäktsprognoserna summerade över månaden.
 * Utfallet är en Excel-fil (regnr i kolumn A, total intäkt i kolumn B) som
 * importeras för en vald månad.
 */

import Navigation from "../../../components/Navigation";
import Footer from "../../../components/Footer";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import {
  buildForecastVsOutcomeExportUrl,
  getCurrentlySignedInUser,
  getForecastVsOutcome,
  importMonthlyOutcome,
  type ForecastVsOutcomeRow,
  type OutcomeImportPreview,
} from "@/lib/api";

const numberFormat = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 });
const percentFormat = new Intl.NumberFormat("sv-SE", {
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});
const signedFormat = new Intl.NumberFormat("sv-SE", {
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});

type SortKey =
  | "name"
  | "regnr"
  | "outcome"
  | "forecast"
  | "forecastStyckegods"
  | "forecastPartigods"
  | "forecastPaketbur"
  | "forecastEgenfakturerat"
  | "diff"
  | "diffPercent"
  | "forecastDays";

type MissingFilter = "all" | "missingOutcome" | "missingForecast";

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "name", label: "Namn", numeric: false },
  { key: "regnr", label: "Regnr", numeric: false },
  { key: "outcome", label: "Utfall", numeric: true },
  { key: "forecast", label: "Prognos", numeric: true },
  { key: "forecastStyckegods", label: "Styckegods", numeric: true },
  { key: "forecastPartigods", label: "Partigods", numeric: true },
  { key: "forecastPaketbur", label: "Paketbur", numeric: true },
  { key: "forecastEgenfakturerat", label: "Egenfakturerat", numeric: true },
  { key: "diff", label: "Diff", numeric: true },
  { key: "diffPercent", label: "Diff %", numeric: true },
  { key: "forecastDays", label: "Dagar med prognos", numeric: true },
];

/** Förra månaden, eftersom utfall normalt importeras i efterhand. */
function defaultMonth(): string {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function sortValue(row: ForecastVsOutcomeRow, key: SortKey): string | number | null {
  switch (key) {
    case "name":
      return row.equipageName;
    case "regnr":
      return row.regnr;
    default:
      return row[key];
  }
}

export default function PrognosUtfall() {
  const router = useRouter();
  const [isCheckingRole, setIsCheckingRole] = useState(true);

  const [month, setMonth] = useState(defaultMonth);
  const [rows, setRows] = useState<ForecastVsOutcomeRow[]>([]);
  const [daysInMonth, setDaysInMonth] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [minAbsDiff, setMinAbsDiff] = useState("");
  const [missingFilter, setMissingFilter] = useState<MissingFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("diff");
  const [sortAsc, setSortAsc] = useState(true);

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<OutcomeImportPreview | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const loadData = useCallback(() => {
    if (!/^\d{4}-\d{2}$/.test(month)) return;
    setIsLoading(true);
    setError(null);
    getForecastVsOutcome(month)
      .then((response) => {
        setRows(response.data?.rows ?? []);
        setDaysInMonth(response.data?.daysInMonth ?? 0);
      })
      .catch((e: unknown) => {
        setRows([]);
        setError(e instanceof Error ? e.message : "Kunde inte hämta data.");
      })
      .finally(() => setIsLoading(false));
  }, [month]);

  useEffect(() => {
    if (!isCheckingRole) loadData();
  }, [isCheckingRole, loadData]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const threshold = Number(minAbsDiff.replace(",", "."));

    const filtered = rows.filter((row) => {
      if (
        query &&
        !row.regnr.toLowerCase().includes(query) &&
        !(row.equipageName ?? "").toLowerCase().includes(query)
      ) {
        return false;
      }
      if (minAbsDiff.trim() !== "" && Number.isFinite(threshold)) {
        if (Math.abs(row.diff) < threshold) return false;
      }
      if (missingFilter === "missingOutcome" && row.outcome !== null) return false;
      if (missingFilter === "missingForecast" && row.forecast !== null) return false;
      return true;
    });

    // Saknade värden hamnar alltid sist, oavsett sorteringsriktning.
    return [...filtered].sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      const result =
        typeof av === "string" && typeof bv === "string"
          ? av.localeCompare(bv, "sv")
          : Number(av) - Number(bv);
      return sortAsc ? result : -result;
    });
  }, [rows, search, minAbsDiff, missingFilter, sortKey, sortAsc]);

  const totals = useMemo(() => {
    const outcome = visibleRows.reduce((sum, r) => sum + (r.outcome ?? 0), 0);
    const forecast = visibleRows.reduce((sum, r) => sum + (r.forecast ?? 0), 0);
    const sumGroup = (
      key:
        | "forecastStyckegods"
        | "forecastPartigods"
        | "forecastPaketbur"
        | "forecastEgenfakturerat",
    ) => visibleRows.reduce((sum, r) => sum + (r[key] ?? 0), 0);
    return {
      outcome,
      forecast,
      diff: outcome - forecast,
      styckegods: sumGroup("forecastStyckegods"),
      partigods: sumGroup("forecastPartigods"),
      paketbur: sumGroup("forecastPaketbur"),
      egenfakturerat: sumGroup("forecastEgenfakturerat"),
    };
  }, [visibleRows]);

  const isPartialMonth = useMemo(
    () => rows.some((r) => r.forecast !== null && r.forecastDays < daysInMonth),
    [rows, daysInMonth],
  );

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(key === "name" || key === "regnr");
    }
  };

  const openImport = () => {
    setImportFile(null);
    setPreview(null);
    setImportMessage(null);
    setImportErrors([]);
    setIsImportOpen(true);
  };

  const handleFileChosen = async (file: File | null) => {
    setImportFile(file);
    setPreview(null);
    setImportMessage(null);
    setImportErrors([]);
    if (!file) return;

    setIsImporting(true);
    try {
      const response = await importMonthlyOutcome<OutcomeImportPreview>(
        file,
        month,
        "preview",
      );
      if (response.status && response.data) {
        setPreview(response.data);
      } else {
        setImportMessage(response.message);
        setImportErrors(response.errors ?? []);
      }
    } catch {
      setImportMessage("Kunde inte läsa filen.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleCommit = async () => {
    if (!importFile) return;
    setIsImporting(true);
    try {
      const response = await importMonthlyOutcome<{ savedRows: number }>(
        importFile,
        month,
        "commit",
      );
      if (response.status) {
        setIsImportOpen(false);
        loadData();
      } else {
        setImportMessage(response.message);
      }
    } catch {
      setImportMessage("Kunde inte spara utfallet.");
    } finally {
      setIsImporting(false);
    }
  };

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

  const inputClass =
    "rounded border-2 border-[var(--seperating-gray)] bg-[var(--input-text)] p-2";
  const buttonClass =
    "rounded bg-[var(--button-fetch)] px-4 py-2 font-bold text-white shadow-md hover:bg-[var(--button-fetch-hover)]";

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)]">
      <Navigation currentPage="analytics" />

      <main className="mx-auto max-w-7xl p-6">
        <h1 className="mb-1 text-3xl font-bold text-[var(--text-heading)]">
          Prognos jämfört med utfall
        </h1>
        <p className="mb-6 text-[var(--text-secondary)]">
          Månadens summerade nattprognos per regnr jämfört med importerat utfall.
          Diff = utfall minus prognos.{" "}
          <a href="/analytics" className="underline">
            Till prognosanalysen
          </a>
        </p>

        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 rounded-lg bg-[var(--primary-element)] p-4 shadow-md">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="pu-month" className="mb-1 block text-sm font-bold">
                Månad
              </label>
              <input
                id="pu-month"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="pu-search" className="mb-1 block text-sm font-bold">
                Sök namn eller regnr
              </label>
              <input
                id="pu-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="t.ex. L80"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="pu-diff" className="mb-1 block text-sm font-bold">
                Minst diff (SEK, +/-)
              </label>
              <input
                id="pu-diff"
                type="number"
                min={0}
                value={minAbsDiff}
                onChange={(e) => setMinAbsDiff(e.target.value)}
                className={`${inputClass} w-36`}
              />
            </div>
            <div>
              <label htmlFor="pu-missing" className="mb-1 block text-sm font-bold">
                Visa
              </label>
              <select
                id="pu-missing"
                value={missingFilter}
                onChange={(e) => setMissingFilter(e.target.value as MissingFilter)}
                className={inputClass}
              >
                <option value="all">Alla</option>
                <option value="missingOutcome">Saknar utfall</option>
                <option value="missingForecast">Saknar prognos</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={openImport} className={buttonClass}>
              Importera utfall
            </button>
            <a
              href={buildForecastVsOutcomeExportUrl(month)}
              className={`${buttonClass} text-center`}
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

        {isPartialMonth && (
          <div
            className="mb-4 flex items-center gap-2 rounded border-2 border-yellow-300 bg-yellow-100 p-3 text-sm text-yellow-800"
            role="alert"
          >
            <TriangleAlert className="h-5 w-5 flex-shrink-0" />
            <span>
              Prognos saknas för en del av dagarna i månaden (se kolumnen Dagar
              med prognos), så diffen kan vara missvisande. Prognos per
              intäktsgrupp finns bara för dagar som körts efter att grupperna
              infördes, så grupperna kan summera till mindre än Prognos.
            </span>
          </div>
        )}

        <div className="overflow-x-auto rounded-lg bg-[var(--primary-element)] p-4 shadow-md">
          {isLoading ? (
            <p className="text-[var(--text-secondary)]">Hämtar...</p>
          ) : rows.length === 0 ? (
            <p className="text-[var(--text-secondary)]">
              Ingen data för vald månad. Importera utfall eller kontrollera att
              prognoser finns sparade.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--seperating-gray)]">
                  {COLUMNS.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      aria-sort={
                        sortKey === column.key
                          ? sortAsc
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                      className={`py-2 pr-4 ${column.numeric ? "text-right" : ""}`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        className="font-bold hover:underline"
                      >
                        {column.label}
                        {sortKey === column.key ? (sortAsc ? " ▲" : " ▼") : ""}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr
                    key={row.regnr}
                    className="border-b border-[var(--seperating-gray)]/40"
                  >
                    <td className="py-2 pr-4">{row.equipageName ?? "–"}</td>
                    <td className="py-2 pr-4">{row.regnr}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {row.outcome === null ? "–" : numberFormat.format(row.outcome)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {row.forecast === null ? "–" : numberFormat.format(row.forecast)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {row.forecastStyckegods === null ? "–" : numberFormat.format(row.forecastStyckegods)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {row.forecastPartigods === null ? "–" : numberFormat.format(row.forecastPartigods)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {row.forecastPaketbur === null ? "–" : numberFormat.format(row.forecastPaketbur)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {row.forecastEgenfakturerat === null ? "–" : numberFormat.format(row.forecastEgenfakturerat)}
                    </td>
                    <td
                      className={`py-2 pr-4 text-right font-bold tabular-nums ${
                        row.diff < 0 ? "text-[var(--error)]" : ""
                      }`}
                    >
                      {signedFormat.format(row.diff)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {row.diffPercent === null
                        ? "–"
                        : `${percentFormat.format(row.diffPercent)} %`}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {row.forecast === null
                        ? "–"
                        : `${row.forecastDays} / ${daysInMonth}`}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold">
                  <td className="py-2 pr-4" colSpan={2}>
                    Totalt ({visibleRows.length} bilar)
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {numberFormat.format(totals.outcome)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {numberFormat.format(totals.forecast)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {numberFormat.format(totals.styckegods)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {numberFormat.format(totals.partigods)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {numberFormat.format(totals.paketbur)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {numberFormat.format(totals.egenfakturerat)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {signedFormat.format(totals.diff)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </main>

      {isImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-xl bg-[var(--primary-element)] p-6 shadow-2xl">
            <h2 className="mb-3 text-lg font-bold text-[var(--text-heading)]">
              Importera utfall för {month}
            </h2>
            <p className="mb-4 text-sm text-[var(--text-secondary)]">
              Välj en .xlsx-fil med regnr i kolumn A och total intäkt i kolumn B.
              Månaden väljs i filtret bakom den här rutan. En import ersätter
              allt utfall som redan finns för månaden.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={(e) => handleFileChosen(e.target.files?.[0] ?? null)}
              className="mb-4 block w-full text-sm"
            />

            {isImporting && (
              <p className="mb-3 text-sm text-[var(--text-secondary)]">Arbetar...</p>
            )}

            {importMessage && (
              <p className="mb-3 font-bold text-[var(--error)]">{importMessage}</p>
            )}
            {importErrors.length > 0 && (
              <ul className="mb-3 max-h-40 list-disc overflow-y-auto pl-5 text-sm">
                {importErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            )}

            {preview && (
              <div className="mb-4 space-y-2 text-sm">
                <p>
                  <b>{preview.rowCount}</b> bilar, total intäkt{" "}
                  <b>{numberFormat.format(preview.totalRevenue)} SEK</b>.
                </p>
                {preview.existingRowsForMonth > 0 && (
                  <p className="text-yellow-800">
                    {preview.existingRowsForMonth} bilar har redan utfall för
                    månaden. De ersätts.
                  </p>
                )}
                {preview.duplicateRegnr.length > 0 && (
                  <p>
                    Regnr som förekom flera gånger och summerades:{" "}
                    {preview.duplicateRegnr.join(", ")}
                  </p>
                )}
                {preview.regnrWithoutForecast.length > 0 && (
                  <p>
                    Regnr utan prognos i {month} (
                    {preview.regnrWithoutForecast.length}):{" "}
                    {preview.regnrWithoutForecast.slice(0, 30).join(", ")}
                    {preview.regnrWithoutForecast.length > 30 ? " …" : ""}
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsImportOpen(false)}
                className="rounded bg-[var(--disabled-button)] px-4 py-2 font-bold"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={handleCommit}
                disabled={!preview || isImporting}
                className={`${buttonClass} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                Spara utfall
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
