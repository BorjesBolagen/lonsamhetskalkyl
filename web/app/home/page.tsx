"use client";

import { getCurrentlySignedInUser, getIlogLines } from "../../lib/api";
import Navigation from "../../components/Navigation";
import Footer from "../../components/Footer";
import { useEffect, useState } from "react";
import LineCard from "../../components/LineCard";
import Card from "../../components/Card";
import {
  AREA_OPTIONS,
  AreaKey,
  AreaState,
  DEFAULT_AREAS,
  parseAreaState,
} from "../../lib/areas";

type IlogLine = {
  id: number;
  name: string;
  fromArea: string;
  toArea: string;
};

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
    leveransstruktur: string,
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

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export default function Home() {
  const STANDRD_FLM = 19.2;

  const [clickedButton, setClickedButton] = useState<Ekipage | null>(null);
  const [manualValue, setManualValue] = useState(15000);
  const [value, setValue] = useState("");

  const [selectedAreas, setSelectedAreas] = useState<AreaState>(DEFAULT_AREAS);
  const [areasLoaded, setAreasLoaded] = useState(false);

  const [linesData, setLinesData] = useState<IlogLine[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);
  const [lineError, setLineError] = useState("");
  const [hasLoadedLines, setHasLoadedLines] = useState(false);

  function convertCapacityToPixels(capacity: number) {
    return (capacity / STANDRD_FLM) * 100;
  }

  function convertProfitToPixels(price: number) {
    if (price < manualValue) {
      return (price / manualValue) * 100;
    }
    return 100;
  }

  function lineMatchesSelectedAreas(line: IlogLine): boolean {
    const activeAreas = Object.entries(selectedAreas).filter(
      ([, isActive]) => isActive,
    );

    if (activeAreas.length === 0) {
      return false;
    }

    const fromArea = normalizeText(line.fromArea);
    return activeAreas.some(([areaKey]) => {
      const areaLabel = normalizeText(AREA_OPTIONS[areaKey as AreaKey]);
      return fromArea.includes(areaLabel);
    });
  }

  const staticLine1: Ekipage[] = [];
  const staticLine2: Ekipage[] = [];
  const staticLine3: Ekipage[] = [];

  const Ekipage1 = new Ekipage(
    "L20",
    "Linköping - Stockholm",
    12000,
    12.4,
    "null",
  );
  const Ekipage2 = new Ekipage(
    "L21",
    "Linköping - Stockholm",
    13000,
    19.2,
    "null",
  );
  const Ekipage3 = new Ekipage(
    "L22",
    "Linköping - Stockholm",
    18500,
    19.2,
    "null",
  );

  const Ekipage4 = new Ekipage("L23", "Linköping - Malmö", 22300, 6.1, "null");
  const Ekipage5 = new Ekipage("L24", "Linköping - Malmö", 9800, 15.6, "null");
  const Ekipage6 = new Ekipage("L25", "Linköping - Malmö", 14200, 5.3, "null");

  const Ekipage7 = new Ekipage(
    "L26",
    "Linköping - Jönköping",
    7600,
    10.9,
    "null",
  );
  const Ekipage8 = new Ekipage(
    "L27",
    "Linköping - Jönköping",
    5400,
    8.2,
    "null",
  );
  const Ekipage9 = new Ekipage(
    "L28",
    "Linköping - Jönköping",
    19900,
    5.4,
    "null",
  );
  const Ekipage10 = new Ekipage(
    "L29",
    "Linköping - Jönköping",
    2000,
    15.8,
    "null",
  );

  staticLine1.push(Ekipage1, Ekipage2, Ekipage3);
  staticLine2.push(Ekipage4, Ekipage5, Ekipage6);
  staticLine3.push(Ekipage7, Ekipage8, Ekipage9, Ekipage10);

  const staticLines: Array<Ekipage>[] = [staticLine1, staticLine2, staticLine3];

  useEffect(() => {
    // Load user's saved area filters once so fetch button uses persisted settings.
    async function loadCurrentUserSettings() {
      try {
        const response = await getCurrentlySignedInUser();
        const user = response.data;

        if (user) {
          setSelectedAreas(parseAreaState(user.filters));
        } else {
          setSelectedAreas(DEFAULT_AREAS);
        }
      } catch (error) {
        setSelectedAreas(DEFAULT_AREAS);
      } finally {
        setAreasLoaded(true);
      }
    }

    loadCurrentUserSettings();
  }, []);

  const loadLines = async () => {
    try {
      setLoadingLines(true);
      setLineError("");
      setHasLoadedLines(true);

      const response = await getIlogLines();
      // Filter only by origin area (fromArea), not destination.
      const filteredLines = (response.data ?? []).filter((line: IlogLine) =>
        lineMatchesSelectedAreas(line),
      );

      setLinesData(filteredLines);
    } catch (error) {
      setLineError("Kunde inte hämta filtrerade linjer, försök igen.");
    } finally {
      setLoadingLines(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#C6E2D8]">
      <Navigation currentPage="home" />
      <main className="flex-grow p-6 flex gap-6">
        <div className="flex-1 space-y-6">
          {staticLines.map((line) => (
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

        <div className="w-[40rem] space-y-6">
          <div className="bg-white rounded-xl shadow-md p-6 max-w-md">
            <p className="mb-2 font-medium">Manuellt värde: {manualValue}</p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setManualValue(Number(value));
              }}
              className="flex gap-2"
            >
              <input
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

              <p>
                <strong>ID:</strong> {clickedButton.getId()}
              </p>
              <p>
                <strong>Linje:</strong> {clickedButton.getLine()}
              </p>
              <p>
                <strong>Pris:</strong> {clickedButton.getPrice()}
              </p>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-md p-6 w-full max-w-none space-y-4">
            <div>
              <p className="font-medium text-gray-800">Aktuella linjer</p>
              {!areasLoaded && (
                <p className="text-sm text-gray-600 mt-1">
                  Laddar dina sparade områden...
                </p>
              )}
            </div>

            <button
              onClick={loadLines}
              disabled={!areasLoaded || loadingLines}
              className="w-full bg-[#75C07A] text-white px-4 py-3 rounded hover:bg-green-800 disabled:bg-gray-400 transition font-semibold"
            >
              {loadingLines
                ? "Hämtar filtrerade linjer..."
                : "Hämta filtrerade linjer"}
            </button>

            <div className="text-sm text-gray-700">
              {!areasLoaded ? (
                <p>Vänta tills inställningarna har laddats.</p>
              ) : lineError ? (
                <p className="text-red-700">{lineError}</p>
              ) : !hasLoadedLines ? (
                <p>Klicka på knappen för att ladda linjerna.</p>
              ) : linesData.length > 0 ? (
                <p>{linesData.length} filtrerade linjer hittades.</p>
              ) : (
                <p>Inga linjer matchade dina valda områden.</p>
              )}
            </div>

            {!loadingLines && !lineError && linesData.length > 0 && (
              <div className="space-y-3">
                {linesData.map((line) => (
                  <LineCard key={line.id} title={line.name}>
                    <div className="text-sm text-gray-700 space-y-1">
                      <p>
                        <strong>ID:</strong> {line.id}
                      </p>
                      <p>
                        <strong>Från:</strong> {line.fromArea}
                      </p>
                      <p>
                        <strong>Till:</strong> {line.toArea}
                      </p>
                    </div>
                  </LineCard>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
