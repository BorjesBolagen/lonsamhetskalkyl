"use client";

import { getCurrentlySignedInUser, getIlogConsignments, getIlogEquipages, getIlogLines } from "../../lib/api";
import type { EquipageItem, ConsignmentListItem } from "@/lib/ilogTypes";
import Navigation from "../../components/Navigation";
import Footer from "../../components/Footer";
import { useEffect, useState, useCallback } from "react";
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

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}


export default function Home() {
  const STANDRD_FLM = 19.2;

  const [selectedEquipage, setSelectedEquipage] = useState<EquipageItem | null>(null);
  const [selectedEquipageError, setSelectedEquipageError] = useState("");
  const [equipagesByLineId, setEquipagesByLineId] = useState<Record<number, EquipageItem[]>>({});
  const [consignments, setConsignments] = useState<ConsignmentListItem[]>([]);
  const [manualValue, setManualValue] = useState(15000);
  const [value, setValue] = useState("");

  const [selectedAreas, setSelectedAreas] = useState<AreaState>(DEFAULT_AREAS);
  const [areasLoaded, setAreasLoaded] = useState<boolean | null>(false);

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

  /**
   * Gets the current date and returns it on a yyyMMdd format. Used for getting consignments
   * @param offsetDays: How many days to offset from today. -1 is yesterday, 1 is tomorrow etc
   */
  function getCurrentDate(offsetDays: number): string {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}${month}${day}`;
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

  const loadLines = useCallback(async () => {
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

    // After getting lines, get equipages for each line
    try {
      const response = await getIlogEquipages(false);
      const equipages = response.data ?? [];

      const byLineId = equipages.reduce<Record<number, EquipageItem[]>>((acc, equipage) => {
        equipage.lines.forEach((line) => {
          if (typeof line.id === "number") {
            acc[line.id] = acc[line.id] ?? [];
            acc[line.id].push(equipage);
          }
        });
        return acc;
      }, {});

      setEquipagesByLineId(byLineId);
    } catch (error) {
      setSelectedEquipageError("Kunde inte hämta ekipage för linje");
      console.log(error);
    }
  }, [selectedAreas]);


  const displayInfo = async (equipage: EquipageItem) => {
    try {
      const response = await getIlogConsignments(getCurrentDate(0), equipage.id, false);
      const consignmentData = response.data ?? [];
      console.log(consignmentData);
      
      const unique = consignmentData.filter((item, index) =>
        consignmentData.findIndex((other) => other.consignmentId === item.consignmentId) === index
      );

      setConsignments(unique);
    } catch (error) {
      setSelectedEquipageError("Kunde inte hämta sändningar på ekipaget");
      console.error(error);
    }
  };

  
  return (
    <div className="">
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <Navigation currentPage="home" />
      <main className="flex-grow p-6 flex gap-10">
        <div>
          {!loadingLines && !lineError && linesData.length > 0 && (
                <div className="space-y-3">
                  {linesData.map((line) => (
                    <LineCard key={line.id} title={line.name}>
                      <div className="text-sm text-[var(--text-primary)] space-y-1">
                        <div className="flex">
                          <div className="flex flex-wrap gap-2">
                            {equipagesByLineId[line.id]?.length ? (
                              equipagesByLineId[line.id].map((equipage) => (
                                <Card
                                  key={equipage.id}
                                  title={equipage.name || String(equipage.id)}
                                  capacity={0}
                                  price={20}
                                >
                                  <button
                                    className="bg-[var(--primary-button)] w-full text-center text-[var(--text-secondary)] px-2 py-1 rounded hover:bg-gray-500 transition text-sm"
                                    onClick={() => {
                                      setSelectedEquipage(equipage);
                                      displayInfo(equipage);
                                    }}
                                  >
                                    Info
                                  </button>
                                </Card>
                              ))
                            ) : (
                              <p className="text-[var(--text-primary)]">Inga ekipage hittades för denna linje.</p>
                            )}
                          </div>
                        </div>
                        
                        <p className="text-[var(--text-primary)]">
                          <strong>ID:</strong> {line.id}
                        </p>
                        <p className="text-[var(--text-primary)]">
                          <strong>Från:</strong> {line.fromArea}
                        </p>
                        <p className="text-[var(--text-primary)]">
                          <strong>Till:</strong> {line.toArea}
                        </p>
                      </div>
                    </LineCard>
                  ))}
                </div>
              )}
          </div>
        <div className="w-[40rem] space-y-6 ml-auto">
          <div className="bg-[var(--primary-element)] rounded-xl shadow-md p-6 max-w-md">
            <p className="text-[var(--text-primary)] mb-2 font-medium">
              Manuellt värde: {manualValue}
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
                className="text-[var(--text-primary)] border-2 border-[var(--border-primary)] rounded p-2 w-full focus:outline-none focus:ring-2 focus:ring-green-700"
              />
              <button
                type="submit"
                className="bg-[var(--primary-button)] text-[var(--text-primary)] px-4 py-2 rounded hover:bg-[var(--primary-button-hover)] transition"
              >
                Spara
              </button>
            </form>
          </div>

          {selectedEquipage && (
            <div className="bg-[var(--primary-element)] rounded-xl shadow-md p-6 max-w-md">
              <h2 className="text-[var(--text-primary)] text-xl font-bold mb-4 border-b pb-2">Detaljer</h2>
              <div>
                <p className="text-[var(--text-primary)]">
                  <strong>ID:</strong> {selectedEquipage.id}
                </p>
                <p className="text-[var(--text-primary)]">
                  <strong>Namn:</strong> {selectedEquipage.name}
                </p>
                <p className="text-[var(--text-primary)]">
                  <strong>Linjer:</strong> {selectedEquipage.lines.map((line) => line.name).join(", ") || "Inga"}
                </p>
                <p className="text-[var(--text-primary)]">
                  <strong>Resurser:</strong> {selectedEquipage.resources.length}
                </p>
              </div>
            </div>
          )}

          {consignments.length > 0 && (
            <div className="bg-[var(--primary-element)] rounded-xl shadow-md p-6 w-full max-w-none overflow-x-auto">
              <h2 className="text-[var(--text-primary)] text-xl font-bold mb-4 border-b pb-2">Sändningar</h2>
              <table className="w-full text-sm text-[var(--text-primary)] border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-primary)]">
                    <th className="text-left px-2 py-2">ID</th>
                    <th className="text-left px-2 py-2">Avsändare Stad</th>
                    <th className="text-left px-2 py-2">Avsändare Adress</th>
                    <th className="text-left px-2 py-2">Mottagare Stad</th>
                    <th className="text-left px-2 py-2">Mottagare Adress</th>
                    <th className="text-left px-2 py-2">Kund</th>
                    <th className="text-left px-2 py-2">Godsuppgifter</th>
                  </tr>
                </thead>
                <tbody>
                  {consignments.map((consignment) => (
                    <tr key={consignment.consignmentId} className="border-b border-[var(--border-primary)] hover:bg-[var(--secondary-element)] transition">
                      <td className="px-2 py-2">{consignment.consignmentId}</td>
                      <td className="px-2 py-2">{consignment.senderCity}</td>
                      <td className="px-2 py-2 text-xs">{consignment.senderAddress}</td>
                      <td className="px-2 py-2">{consignment.destinationCity}</td>
                      <td className="px-2 py-2 text-xs">{consignment.destinationAddress}</td>
                      <td className="px-2 py-2">{consignment.customerName}</td>
                      <td className="px-2 py-2 text-xs">{consignment.estimatedProperties}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="bg-[var(--primary-element)] rounded-xl shadow-md p-6 w-full max-w-none space-y-4">
            <div>
              <p className="font-medium text-[var(--text-primary)]">Aktuella linjer</p>
              {!areasLoaded && (
                <p className="text-sm text-[var(--text-primary)] mt-1">
                  Laddar dina sparade områden...
                </p>
              )}
            </div>

            <button
              onClick={loadLines}
              disabled={!areasLoaded || loadingLines}
              suppressHydrationWarning
              className="w-full bg-[var(--primary-button)] text-[var(--text-primary)] px-4 py-3 rounded hover:bg-[var(--primary-button-hover)] disabled:bg-gray-400 transition font-semibold"
            >
              {loadingLines
                ? "Hämtar filtrerade linjer..."
                : "Hämta filtrerade linjer"}
            </button>

            <div className="text-sm text-[var(--primary-text)]">
              {!areasLoaded ? (
                <p className="text-[var(--text-primary)]">Vänta tills inställningarna har laddats.</p>
              ) : lineError ? (
                <p className="text-[var(--error)]">{lineError}</p>
              ) : !hasLoadedLines ? (
                <p className="text-[var(--text-primary)]">Klicka på knappen för att ladda linjerna.</p>
              ) : linesData.length > 0 ? (
                <p className="text-[var(--text-primary)]">{linesData.length} filtrerade linjer hittades.</p>
              ) : (
                <p>Inga linjer matchade dina valda områden.</p>
              )}
            </div>

            
          </div>
        </div>
      </main>
      <Footer/>
    </div>
  </div>
  );
}
