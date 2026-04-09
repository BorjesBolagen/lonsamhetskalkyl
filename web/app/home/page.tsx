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
    <div className="min-h-screen flex flex-col bg-[#EEEEEE]">
      <Navigation currentPage="home" />
      <main className="flex-grow p-6 flex gap-10">
        <div>
          {!loadingLines && !lineError && linesData.length > 0 && (
                <div className="space-y-3">
                  {linesData.map((line) => (
                    <LineCard key={line.id} title={line.name}>
                      <div className="text-sm text-gray-300 space-y-1">
                        <div className="flex">
                          <Card
                            key={Ekipage1.getId()}
                            title={Ekipage1.getId()}
                            capacity={convertCapacityToPixels(Ekipage1.getCapacity())}
                            price={convertProfitToPixels(Ekipage1.getPrice())}
                          >
                            <button
                              onClick={() => setClickedButton(Ekipage1)}
                            >
                              Info
                            </button>
                          </Card>
                          <Card
                            key={Ekipage2.getId()}
                            title={Ekipage2.getId()}
                            capacity={convertCapacityToPixels(Ekipage2.getCapacity())}
                            price={convertProfitToPixels(Ekipage2.getPrice())}
                          >
                            <button
                              onClick={() => setClickedButton(Ekipage2)}
                              className=""
                            >
                              Info
                            </button>
                          </Card>
                          <Card
                            key={Ekipage3.getId()}
                            title={Ekipage3.getId()}
                            capacity={convertCapacityToPixels(Ekipage3.getCapacity())}
                            price={convertProfitToPixels(Ekipage3.getPrice())}
                          >
                            <button
                              onClick={() => setClickedButton(Ekipage3)}
                              className=""
                            >
                              Info
                            </button>
                          </Card>
                        </div>
                        
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
        <div className="w-[40rem] space-y-6 ml-auto">
          <div className="bg-[#000000] rounded-xl shadow-md p-6 max-w-md">
            <p className="text-gray-300 mb-2 font-medium">Manuellt värde: {manualValue}</p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setManualValue(Number(value));
              }}
              className="flex gap-2"
            >
              <input
                onChange={(e) => setValue(e.target.value)}
                className="text-gray-300 border-2 border-gray-300 rounded p-2 w-full focus:outline-none focus:ring-2 focus:ring-green-700"
              />
              <button
                type="submit"
                className="bg-[#75C07A] text-black px-4 py-2 rounded hover:bg-green-800 transition"
              >
                Spara
              </button>
            </form>
          </div>

          {clickedButton && (
            <div className="bg-[#000000] rounded-xl shadow-md p-6 max-w-md">
              <h2 className="text-gray-300 text-xl font-bold mb-4 border-b pb-2">Detaljer</h2>
              <div className="text-gray-300">
                <p>
                  <strong>ID:</strong> {clickedButton.getId()}
                </p>
                <p>
                  <strong >Linje:</strong> {clickedButton.getLine()}
                </p>
                <p>
                  <strong>Pris:</strong> {clickedButton.getPrice()}
                </p>
              </div>
            </div>
          )}

          <div className="bg-[#000000] rounded-xl shadow-md p-6 w-full max-w-none space-y-4">
            <div>
              <p className="font-medium text-gray-300">Aktuella linjer</p>
              {!areasLoaded && (
                <p className="text-sm text-gray-300 mt-1">
                  Laddar dina sparade områden...
                </p>
              )}
            </div>

            <button
              onClick={loadLines}
              disabled={!areasLoaded || loadingLines}
              className="w-full bg-[#BB86FC] text-white px-4 py-3 rounded hover:bg-purple-300 disabled:bg-gray-400 transition font-semibold"
            >
              {loadingLines
                ? "Hämtar filtrerade linjer..."
                : "Hämta filtrerade linjer"}
            </button>

            <div className="text-sm text-gray-300">
              {!areasLoaded ? (
                <p>Vänta tills inställningarna har laddats.</p>
              ) : lineError ? (
                <p className="text-red-300">{lineError}</p>
              ) : !hasLoadedLines ? (
                <p>Klicka på knappen för att ladda linjerna.</p>
              ) : linesData.length > 0 ? (
                <p>{linesData.length} filtrerade linjer hittades.</p>
              ) : (
                <p>Inga linjer matchade dina valda områden.</p>
              )}
            </div>

            
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
