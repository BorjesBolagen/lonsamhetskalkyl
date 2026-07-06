"use client";

import { useEffect, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { InfoTooltip } from "@/components/InformationBubble";
import { PostgrestError } from "@supabase/supabase-js";
import { translateSupabaseError } from "@/lib/supabaseErrorTranslation";

type PriceAdjustmentRow = {
  datum: string;
  generell_prisjustering: number | null;
  procent_verkstallt: number | null;
  justerat: number | null;
};

type PriceAdjustmentsPopupProps = {
  isOpen: boolean;
  onClose: () => void;
};

const formatPercentValue = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(3)}%`;
};

const parsePercentInput = (value: string) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  return numericValue / 100;
};

export function PriceAdjustmentsPopup({ isOpen, onClose }: PriceAdjustmentsPopupProps) {
  const [priceAdjustments, setPriceAdjustments] = useState<PriceAdjustmentRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newAdjustmentDate, setNewAdjustmentDate] = useState("");
  const [newAdjustmentGeneral, setNewAdjustmentGeneral] = useState("");
  const [newAdjustmentPercent, setNewAdjustmentPercent] = useState("");
  const [isSavingNew, setIsSavingNew] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const loadPriceAdjustments = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("prisjusteringar")
          .select("datum, generell_prisjustering, procent_verkstallt, justerat")
          .order("datum", { ascending: false });

        if (error) throw error;
        setPriceAdjustments((data ?? []) as PriceAdjustmentRow[]);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(`Kunde inte hämta prishöjningar: ${message}`);
      } finally {
        setIsLoading(false);
      }
    };

    loadPriceAdjustments();
  }, [isOpen]);

  const resetNewForm = () => {
    setNewAdjustmentDate("");
    setNewAdjustmentGeneral("");
    setNewAdjustmentPercent("");
  };

  const handleAddPriceAdjustment = async (e: FormEvent) => {
    e.preventDefault();

    if (!newAdjustmentDate) {
      setError("Välj ett datum innan du lägger till en ny post.");
      return;
    }

    setIsSavingNew(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const payload = {
        datum: newAdjustmentDate,
        generell_prisjustering: parsePercentInput(newAdjustmentGeneral),
        procent_verkstallt: parsePercentInput(newAdjustmentPercent),
      };

      const { data, error } = await supabase
        .from("prisjusteringar")
        .insert(payload)
        .select("datum, generell_prisjustering, procent_verkstallt, justerat")
        .single();

      if (error) throw error;

      setPriceAdjustments((prev) => {
        const nextRows = [data as PriceAdjustmentRow, ...prev];
        return nextRows.sort((a, b) => b.datum.localeCompare(a.datum));
      });
      resetNewForm();
    } catch (err) {
      // Duck-type instead of instanceof — avoids bundle/import mismatches
      const isPostgrestLike =
          typeof err === "object" && err !== null && "code" in err && "message" in err;

      const message = isPostgrestLike
          ? translateSupabaseError(err as PostgrestError).swedishMessage
          : err instanceof Error
          ? err.message
          : String(err);

      console.error(err, message);
      setError(`Kunde inte spara rad: ${message}`);
    } finally {
      setIsSavingNew(false);
    }
  };

  const handleDeletePriceAdjustment = async (datum: string) => {
    if (!window.confirm("Är du säker på att du vill ta bort den här raden?")) return;

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("prisjusteringar").delete().eq("datum", datum);

      if (error) throw error;

      setPriceAdjustments((prev) => prev.filter((row) => row.datum !== datum));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Kunde inte ta bort posten: ${message}`);
    }
  };

  const priceAdjustmentsWithRunningTotal = (() => {
    let runningTotal = 0;

    return [...priceAdjustments]
      .sort((a, b) => b.datum.localeCompare(a.datum))
      .map((row) => {
        const previousTotal = runningTotal;
        runningTotal += Number(row.justerat ?? 0);
        return {
          ...row,
          runningTotal: previousTotal,
        };
      });
  })();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/45 flex items-center justify-center p-4">
      <div className="bg-[var(--primary-element)] p-8 rounded-xl shadow-xl w-full max-w-5xl relative text-[var(--text-primary)]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-black text-xl"
        >
          ✖
        </button>
        <h3 className="font-bold text-xl mb-4 border-b-2 border-green-500 pb-2">
          Uppdatera prishöjningar
        </h3>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Här visas de aktuella prishöjningarna från Supabase och du kan lägga till eller ta bort prisskillnader över år.
        </p>

        <form onSubmit={handleAddPriceAdjustment} className="mb-5 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Datum</label>
            <input
              type="date"
              value={newAdjustmentDate}
              onChange={(e) => setNewAdjustmentDate(e.target.value)}
              className="w-full rounded p-2 border border-gray-300 bg-[var(--input-text)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Generell prisjustering (%)</label>
            <input
              type="number"
              step="0.01"
              value={newAdjustmentGeneral}
              onChange={(e) => setNewAdjustmentGeneral(e.target.value)}
              placeholder="0"
              className="w-full rounded p-2 border border-gray-300 bg-[var(--input-text)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Procent verkställt (%)</label>
            <input
              type="number"
              step="0.01"
              value={newAdjustmentPercent}
              onChange={(e) => setNewAdjustmentPercent(e.target.value)}
              placeholder="0"
              className="w-full rounded p-2 border border-gray-300 bg-[var(--input-text)]"
            />
          </div>
          <div className="flex flex-col justify-end">
            <button
              type="submit"
              disabled={isSavingNew}
              className="w-full rounded bg-[#446E30] px-3 py-2 text-white font-semibold disabled:opacity-50"
            >
              {isSavingNew ? "Sparar..." : "Lägg till"}
            </button>
          </div>
        </form>

        {error && (
          <p className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {isLoading ? (
          <p className="text-sm text-[var(--text-secondary)]">Laddar prishöjningar...</p>
        ) : priceAdjustmentsWithRunningTotal.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">Inga prishöjningar finns sparade ännu.</p>
        ) : (
          <div className="overflow-visible">
            <table className="w-full border-collapse text-left text-sm overflow-visible">
              <thead>
                <tr className="border-b border-gray-300 bg-[var(--secondary-element)]">
                  <th className="p-3 font-semibold relative z-[1000]">Nr</th>
                  <th className="p-3 font-semibold relative z-[1000]">Datum fr.o.m</th>
                  <th className="p-3 font-semibold relative z-[1000]">Generell prisjustering</th>
                  <th className="p-3 font-semibold relative z-[1000]">
                    <span className="flex items-center gap-1">
                      Procent Verkställt
                      <InfoTooltip text={"Procentdel av höjningen som verkställs"} />
                    </span>
                  </th>
                  <th className="p-3 font-semibold relative z-[1000]">
                    <span className="flex items-center gap-1">
                      Justerat
                      <InfoTooltip text={"Räknat som generell prisjustering * procent verkställt"} />
                    </span>
                  </th>
                  <th className="p-3 font-semibold">
                    <span className="flex items-center gap-1">
                      Summa tidigare justerat
                      <InfoTooltip text={"Procentsats som sändelser inom detta datum ökas med. Just nu bara på steg 1"} />
                    </span>
                  </th>
                  <th className="p-3 font-semibold relative z-[1000]">Hantera</th>
                </tr>
              </thead>
              <tbody>
                {priceAdjustmentsWithRunningTotal.map((row, index) => (
                  <tr key={`${row.datum}-${row.generell_prisjustering}`} className="border-b border-gray-200">
                    <td className="p-3">{index + 1}</td>
                    <td className="p-3">{row.datum}</td>
                    <td className="p-3">{formatPercentValue(row.generell_prisjustering)}</td>
                    <td className="p-3">{formatPercentValue(row.procent_verkstallt)}</td>
                    <td className="p-3">{formatPercentValue(row.justerat)}</td>
                    <td className="p-3">{formatPercentValue(row.runningTotal)}</td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => handleDeletePriceAdjustment(row.datum)}
                        title="Ta bort"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-gray-700 hover:text-red-500 hover:bg-red-50"
                      >
                        <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
                          <path
                            d="M1 3.5h12M5 3.5V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v1M5.5 6.5v4M8.5 6.5v4M2.5 3.5l.8 8a.5.5 0 00.5.5h6.4a.5.5 0 00.5-.5l.8-8"
                            stroke="currentColor"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
