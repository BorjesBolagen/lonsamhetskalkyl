"use client";
import { useState } from "react";
import Navigation from "../../components/Navigation";
import Footer from "../../components/Footer";

export default function ProfitCalculatorPage() {
  const [form, setForm] = useState({
    start: "",
    end: "",
    flm: "",
    volume: "",
    price: "",
    weight: "",
  });
  const [result, setResult] = useState("");
  const handleReset = () => {
    setForm({
      start: "",
      end: "",
      flm: "",
      volume: "",
      price: "",
      weight: "",
    });
    setResult("");
  };

  const [isAnimating, setIsAnimating] = useState(false);


  // Hantera input ändringar
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.id]: e.target.value });
  };
  // Test logic
  const handleCalculate = () => {
    const values = Object.values(form)
    const allOnes = values.every((v) => v === "1");

    if (allOnes) {
      setResult("Lönsam");
    } else {
      setResult("Ej lönsam");
    }
    setIsAnimating(true);

    setTimeout(() => {
      setIsAnimating(false);
    }, 1000);
 
  };
  return (
    <div className="min-h-screen flex flex-col bg-[#EEEEEE]">
      <Navigation currentPage="simulator" />

      <main className="flex-grow flex flex-col lg:flex-row justify-center p-6 gap-6">
        
        {/* LEFT CARD (FORM) */}
        <div className="bg-white max-w-md w-full rounded-xl shadow-md p-8 space-y-6">
          <h1 className="text-2xl font-bold text-center">
            Räkna ut lönsamhet
          </h1>

          <form
            className="grid grid-cols-1 sm:grid-cols-2 gap-6"
            onSubmit={(e) => e.preventDefault()} // prevent reload
          >
            {[
              { id: "start", label: "Startdestination" },
              { id: "flm", label: "FLM" },
              { id: "end", label: "Slutdestination" },
              { id: "volume", label: "Volym" },
              { id: "price", label: "Pris" },
              { id: "weight", label: "Vikt" },
            ].map((field) => (
              <div
                key={field.id}
                className="flex flex-col bg-gray-50 p-4 rounded-lg shadow-sm"
              >
                <label className="mb-1 text-sm font-medium">
                  {field.label}
                </label>
                <input
                  id={field.id}
                  type="text"
                  value={(form as any)[field.id]}
                  onChange={handleChange}
                  className="border-2 border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-green-700"
                />
              </div>
            ))}
          </form>

          <div className="mt-6 flex justify-between">
            <button
              onClick={handleCalculate}
              className="bg-[#75C07A] text-white px-4 py-2 rounded hover:bg-green-800 transition-colors duration-300"
            >
              → Beräkna
            </button>
            <button
            type="button"
            onClick={handleReset}
             className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors duration-300"
          >
             Återställ
         </button>
          </div>
</div>
        {/* RIGHT CARD (RESULT) */}
        <div className="bg-white max-w-md w-full rounded-xl shadow-md p-8 space-y-6">
          <h1 className="text-3xl font-bold text-center text-gray-800 mb-6 border-b-2 border-green-500 pb-2">
            Resultat
          </h1>

        <div className="text-center">
  {!result && (
    <p className="text-gray-500 italic">
      Fyll i värden och klicka på Beräkna
    </p>
  )}

  {result && (
    <div
      className={`mt-4 p-4 rounded-lg font-semibold text-lg ${
        result.includes("Lönsam")
          ? "bg-green-100 text-green-800"
          : "bg-red-100 text-red-800"
      }${isAnimating ? " animate-pulse" : ""}`}
    >
      {result}
    </div>
  )}
</div>
        </div>
      </main>

      <Footer />
    </div>
  );
}