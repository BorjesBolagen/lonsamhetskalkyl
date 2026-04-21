"use client";

import { useEffect, useState } from "react";
import Navigation from "../../components/Navigation";
import Footer from "../../components/Footer";
import {
	calculateProfitability,
	type ProfitabilityResponse,
} from "@/lib/api";

type FormState = {
  kundnamn: string;
  taxeprel: string;
  vikt: string;
};

export default function ProfitCalculatorPage() {
  const [form, setForm] = useState<FormState>({
    kundnamn: "",
    taxeprel: "",
    vikt: "",
  });

  const [result, setResult] = useState<ProfitabilityResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isAnimating, setIsAnimating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [threshold, setThreshold] = useState<number>(15000);

  useEffect(() => {
    const savedThreshold = localStorage.getItem("profitabilityThreshold");
    if (savedThreshold) {
      const parsed = Number(savedThreshold);
      if (Number.isFinite(parsed) && parsed >= 0) {
        setThreshold(parsed);
      }
    }
  }, []);

  const handleReset = () => {
    setForm({
      kundnamn: "",
      taxeprel: "",
      vikt: "",
    });
    setResult(null);
    setErrorMsg("");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleCalculate = async () => {
    setErrorMsg("");
    setResult(null);
    setIsLoading(true);

    try {
      if (!form.kundnamn.trim()) {
        setErrorMsg("Kundnamn måste fyllas i.");
        return;
      }
      if (!form.taxeprel.trim()) {
        setErrorMsg("Taxerelation måste fyllas i.");
        return;
      }

      if (!form.vikt.trim()) {
        setErrorMsg("Fraktgrundande vikt måste fyllas i.");
        return;
      }

      const parsedWeight = Number(form.vikt);

      if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
        setErrorMsg("Fraktgrundande vikt måste vara ett giltigt tal större än 0.");
        return;
      }

      const data = await calculateProfitability(
      form.kundnamn.trim(),
      form.taxeprel.trim(),
      parsedWeight
       );

			if (!data.success) {
				const detailText = Array.isArray(data.detail)
					? data.detail
							.map((d) => (typeof d?.msg === "string" ? d.msg : JSON.stringify(d)))
							.join(", ")
					: typeof data.detail === "string"
					? data.detail
					: "";

				setErrorMsg(data.error || detailText || "Beräkningen misslyckades.");
				return;
			}

      setResult(data);
      setIsAnimating(true);

      setTimeout(() => {
        setIsAnimating(false);
      }, 1000);
    } catch (err) {
      setErrorMsg("Kunde inte kontakta servern: " + (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const estimatedRevenue = result?.value?.estimated_revenue ?? null;
  const isProfitable =
    estimatedRevenue !== null ? estimatedRevenue >= threshold : null;

  return (
    <div className="">
      <div className="min-h-screen flex flex-col bg-[var(--bg)]">
        <Navigation currentPage="simulator" />

      <main className="flex-grow flex flex-col lg:flex-row justify-center p-6 gap-6">
        <div className="bg-[var(--primary-element)] max-w-md w-full rounded-xl shadow-md p-8 space-y-6">
          <h1 className="text-[var(--text-primary)] text-2xl font-bold text-center">
            Räkna ut lönsamhet
          </h1>

          <form
            className="grid grid-cols-1 sm:grid-cols-2 gap-6"
            onSubmit={(e) => e.preventDefault()}
          >
            {[
              { id: "kundnamn", label: "Kundnamn" },
              { id: "start", label: "Start" },
              { id: "slut", label: "Slut" },
              { id: "vikt", label: "Fraktgrundande vikt" },
            ].map((field) => (
              <div
                key={field.id}
                className="flex flex-col bg-[var(--secondary-element)] p-4 rounded-lg shadow-sm"
              >
                <label htmlFor={field.id} className="mb-1 text-[var(--text-primary)] text-sm font-medium">
                  {field.label}
                </label>
                <input
                  id={field.id}
                  type="text"
                  value={form[field.id as keyof FormState]}
                  onChange={handleChange}
                  className="bg-[var(--input-text)] text-[var(--text-primary)] focus:outline-none rounded p-1 w-full"
                />
              </div>
            ))}
          </form>

          <div className="mt-6 flex justify-between">
            <button
              onClick={handleCalculate}
              disabled={isLoading}
              className="bg-[var(--button-submit)] text-white px-4 py-2 rounded hover:bg-[var(--button-submit-hover)] transition-colors duration-300 disabled:opacity-50"
            >
              {isLoading ? "Beräknar..." : "→ Beräkna"}
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="bg-[var(--button-reset)] text-white px-4 py-2 rounded hover:bg-[var(--button-reset-hover)] transition-colors duration-300"
            >
              Återställ
            </button>
          </div>
        </div>

        <div className="bg-[var(--primary-element)] max-w-md w-full rounded-xl shadow-md p-8 space-y-6">
          <h1 className="text-3xl font-bold text-center text-[var(--text-primary)] mb-6 border-b-2 border-[var(--primary-color)] pb-2">
            Resultat
          </h1>

          <div className="text-center">
            {!result && !errorMsg && (
              <p className="text-[var(--text-secondary)] italic">
                Fyll i värden och klicka på Beräkna
              </p>
            )}

            {errorMsg && (
              <div className="mt-4 p-4 rounded-lg font-semibold text-lg bg-red-100 text-red-800">
                {errorMsg}
              </div>
            )}

            {result?.value && (
              <>
                <div
                  className={`mt-4 p-4 rounded-lg font-semibold text-lg ${
                    isProfitable
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  } ${isAnimating ? "animate-pulse" : ""}`}
                >
                  {isProfitable ? "Lönsam" : "Ej lönsam"}
                </div>

                <div className="mt-4 text-left bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                  <p><strong>Steg:</strong> {result.value.step_used}</p>
                  <p><strong>Taxeprel:</strong> {result.value.taxeprel}</p>
                  <p><strong>Viktklass:</strong> {result.value.vklfgrv}</p>
                  <p><strong>Beräknad intäkt:</strong> {result.value.estimated_revenue.toFixed(2)}</p>
                  <p><strong>Tröskelvärde:</strong> {threshold.toFixed(2)}</p>
                  <p><strong>Förklaring:</strong> {result.value.explanation}</p>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

        <Footer />
      </div>
    </div>
  );
}