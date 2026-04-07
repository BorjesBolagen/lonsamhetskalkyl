"use client";

import { getIlogLines } from "../../lib/api";
import Navigation from "../../components/Navigation";
import Footer from "../../components/Footer";
import { useEffect, useState } from "react";
import LineCard from "../../components/LineCard";
import Card from "../../components/Card";

class Line {
  private id: number;
  private name: string;
  private fromArea: string;
  private toArea: string;

  public constructor(
    id: number,
    name: string,
    fromArea: string,
    toArea: string
  ) {
    this.id = id;
    this.name = name;
    this.fromArea = fromArea;
    this.toArea = toArea;
  }

  public getId(): number {
    return this.id;
  }

  public getName(): string {
    return this.name;
  }

  public getFromArea(): string {
    return this.fromArea;
  }

  public getToArea(): string {
    return this.toArea;
  }
}

class Ekipage {
  private id: string;
  private line: string;
  private price: number;
  private capacity: number;
  private leveransstruktur: string;

  public constructor(
    id: string,
    line: string,
    price: number,
    capacity: number,
    leveransstruktur: string
  ) {
    this.id = id;
    this.line = line;
    this.price = price;
    this.capacity = capacity;
    this.leveransstruktur = leveransstruktur;
  }

  public getId(): string {
    return this.id;
  }

  public getLine(): string {
    return this.line;
  }

  public getPrice(): number {
    return this.price;
  }

  public getCapacity(): number {
    return this.capacity;
  }
}

export default function Home() {
  const STANDRD_FLM = 19.2;

  const [clickedButton, setClickedButton] = useState<Ekipage | null>(null);
  const [manualValue, setManualValue] = useState(15000);
  const [value, setValue] = useState("");
  const [linesData, setLinesData] = useState<Line[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);
  const [lineError, setLineError] = useState("");

  function convertCapacityToPixels(capacity: number) {
    return (capacity / STANDRD_FLM) * 100;
  }

  function convertProfitToPixels(price: number) {
    if (price < manualValue) {
      return (price / manualValue) * 100;
    }
    return 100;
  }

  const linje1: Ekipage[] = [];
  const linje2: Ekipage[] = [];
  const linje3: Ekipage[] = [];

  const Ekipage1 = new Ekipage("L20", "Linköping - Stockholm", 12000, 12.4, "null");
  const Ekipage2 = new Ekipage("L21", "Linköping - Stockholm", 13000, 19.2, "null");
  const Ekipage3 = new Ekipage("L22", "Linköping - Stockholm", 18500, 19.2, "null");

  const Ekipage4 = new Ekipage("L23", "Linköping - Malmö", 22300, 6.1, "null");
  const Ekipage5 = new Ekipage("L24", "Linköping - Malmö", 9800, 15.6, "null");
  const Ekipage6 = new Ekipage("L25", "Linköping - Malmö", 14200, 5.3, "null");

  const Ekipage7 = new Ekipage("L26", "Linköping - Jönköping", 7600, 10.9, "null");
  const Ekipage8 = new Ekipage("L27", "Linköping - Jönköping", 5400, 8.2, "null");
  const Ekipage9 = new Ekipage("L28", "Linköping - Jönköping", 19900, 5.4, "null");
  const Ekipage10 = new Ekipage("L29", "Linköping - Jönköping", 2000, 15.8, "null");

  linje1.push(Ekipage1, Ekipage2, Ekipage3);
  linje2.push(Ekipage4, Ekipage5, Ekipage6);
  linje3.push(Ekipage7, Ekipage8, Ekipage9, Ekipage10);

  const lines: Array<Ekipage>[] = [linje1, linje2, linje3];

  const loadLines = async () => {
    try {
      setLoadingLines(true);
      setLineError("");

      const response = await getIlogLines();
      const lines = (response.data ?? []).map(
        (line) => new Line(line.id, line.name, line.fromArea, line.toArea)
      );

      setLinesData(lines);
    } catch (error) {
      setLineError("Failed to load lines, try again");
    } finally {
      setLoadingLines(false);
    }
  };

  useEffect(() => {
    loadLines();

    const savedThreshold = localStorage.getItem("profitabilityThreshold");
    if (savedThreshold) {
      const parsed = Number(savedThreshold);
      if (Number.isFinite(parsed) && parsed >= 0) {
        setManualValue(parsed);
      }
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#C6E2D8]">
      <Navigation currentPage="home" />

      <main className="flex-grow p-6 flex gap-6">
        <div className="flex-1 space-y-6">
          {lines.map((line) => (
            <LineCard key={line[0].getId()} title={line[0].getLine()}>
              {line.map((ekipage) => (
                <Card
                  key={ekipage.getId()}
                  title={ekipage.getId()}
                  capacity={convertCapacityToPixels(ekipage.getCapacity())}
                  price={convertProfitToPixels(ekipage.getPrice())}
                >
                  <button
                    onClick={() => setClickedButton(ekipage)}
                    className="bg-[#75C07A] text-white px-2 py-1 rounded hover:bg-green-800 transition text-sm"
                  >
                    Info
                  </button>
                </Card>
              ))}
            </LineCard>
          ))}
        </div>

        <div className="w-80 space-y-6">
          <div className="bg-white rounded-xl shadow-md p-6 max-w-md">
            <p className="mb-2 font-medium">
              Manuellt tröskelvärde: {manualValue}
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const parsedValue = Number(value);

                if (!Number.isFinite(parsedValue) || parsedValue < 0) {
                  return;
                }

                setManualValue(parsedValue);
                localStorage.setItem("profitabilityThreshold", String(parsedValue));
                setValue("");
              }}
              className="flex gap-2"
            >
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="border-2 border-gray-300 rounded p-2 w-full focus:outline-none focus:ring-2 focus:ring-green-700"
              />
              <button
                type="submit"
                className="bg-[#75C07A] text-white px-4 py-2 rounded hover:bg-green-800 transition"
              >
                Spara
              </button>
            </form>
          </div>

          {clickedButton && (
            <div className="bg-white rounded-xl shadow-md p-6 max-w-md">
              <h2 className="text-xl font-bold mb-4 border-b pb-2">Detaljer</h2>

              <p><strong>ID:</strong> {clickedButton.getId()}</p>
              <p><strong>Linje:</strong> {clickedButton.getLine()}</p>
              <p><strong>Pris:</strong> {clickedButton.getPrice()}</p>
            </div>
          )}

          <button onClick={loadLines}>Ladda linjer</button>

          <div className="bg-white rounded-xl shadow-md p-6 max-w-md">
            <p className="mb-2 font-medium">
              Linjer från API:{" "} {loadingLines ? "Laddar..." : lineError ? lineError : linesData.length > 0 ? "Laddat!" : "Inga linjer"}
            </p>

            {!loadingLines && !lineError && linesData.length > 0 && (
              <ul className="mt-3 space-y-2 text-sm">
                {linesData.map((line) => (
                  <li key={line.getId()} className="border rounded p-2 bg-gray-50">
                    <p><strong>{line.getName()}</strong></p>
                    <p>ID: {line.getId()}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}