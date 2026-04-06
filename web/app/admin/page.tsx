"use client";
import Navigation from "../../components/Navigation";
import Footer from "../../components/Footer";
import { useRef, useState } from "react";
import {
  HistoricalImportError,
  importHistoricalCSV,
  sendMessage,
  signUpProcedure,
} from "@/lib/api";
import { Enums, Constants } from "@/lib/supabaseServerSchema";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

// Mock data uppdaterad med "arbetsvolym" istället för status
const mockTrafficLeaders = [
  {
    id: 1,
    name: "Kalle Karlsson",
    email: "kalle@gmail.se",
    district: "Växjö",
    kpi: "187 kr/flm",
    arbetsvolym: "24 aktiva bilar",
  },
  {
    id: 2,
    name: "Anna Andersson",
    email: "anna@gmail.se",
    district: "Linköping",
    kpi: "145 kr/flm",
    arbetsvolym: "18 aktiva bilar",
  },
  {
    id: 3,
    name: "Sven Svensson",
    email: "sven@gmail.se",
    district: "Jönköping",
    kpi: "192 kr/flm",
    arbetsvolym: "32 aktiva bilar",
  },
];

type TrafficLeader = (typeof mockTrafficLeaders)[number];

export default function Admin() {
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isMessagePopupOpen, setIsMessagePopupOpen] = useState(false);
  const [isCSVImportPopupOpen, setisCSVImportPopupOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<TrafficLeader | null>(null);

  const [adminMessage, setAdminMessage] = useState("");
  const [adminResponse, setAdminResponse] = useState("");
  const [isSendingMessage, setIsSending] = useState(false);

  type UserRole = Enums<"User_specialization_types">;
  const [role, setRole] = useState<UserRole | "">("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [signupResponse, setSignupResponse] = useState("");
  const [isImportingCSV, setIsImportingCSV] = useState(false);
  const [csvImportResponse, setCSVImportResponse] = useState("");
  const [csvImportErrors, setCSVImportErrors] = useState<string[]>([]);
  // UI-status för importflödet: vilken fas vi är i, hur långt servern kommit och vilken förklarande text användaren ska se.
  const [csvImportStage, setCSVImportStage] = useState("");
  const [csvImportProgress, setCSVImportProgress] = useState(0);
  const [csvImportProgressText, setCSVImportProgressText] = useState("");
  // Progressbaren visas endast när servern faktiskt bearbetar data (inte vid ren filuppladdning).
  const [showCSVServerProgress, setShowCSVServerProgress] = useState(false);
  // Dold filinput triggas från en stylad knapp för bättre UX.
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  // State för att visa/dölja lösenordet när admin skapar en ny användare
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  // Ikoner för ögat
  const EyeIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="w-6 h-6"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 010-.644C3.542 4.639 8.05 1 12 1c3.95 0 8.454 3.469 9.964 10.678.07.322.07.653 0 0.976 C20.457 18.332 15.947 22 12 22c-3.95 0-8.454-3.469-9.964-10.678z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );

  const EyeSlashIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="w-6 h-6"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
      />
    </svg>
  );

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminMessage.trim()) return;
    setIsSending(true);
    try {
      const data = await sendMessage(adminMessage);
      setAdminResponse(`Backend svarade: ${data.received}`);
      setAdminMessage("");
    } catch (error) {
      setAdminResponse("Fel: " + (error as Error).message);
    } finally {
      setIsSending(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!signupEmail.trim() || !signupPassword.trim() || role === "") return;
    setIsSigningUp(true);

    try {
      const supabase = getSupabaseBrowserClient();

      // Check if email already exists
      const APIsignUpResponse = await signUpProcedure(signupEmail);
      if (!APIsignUpResponse.status) throw new Error(APIsignUpResponse.message);

      // Supabase signup
      const { data, error } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
      });

      if (error) throw error;
      if (!data.user) throw new Error("Kunde inte skapa användare");

      // Update role in User table
      const { error: updateError } = await supabase
        .from("User")
        .update({ role })
        .eq("id", data.user.id);

      if (updateError) throw updateError;

      // Success
      setSignupResponse(
        `Skapade användare ${data.user.email}. Ett verifieringsmail har skickats. Kom ihåg att kolla skräpposten.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      setSignupResponse(`Fel vid registrering: ${message}`);
    } finally {
      setIsSigningUp(false);
    }
  };

  const handleCSVUploadClick = () => {
    // Öppnar systemets filväljare via den dolda inputen.
    csvInputRef.current?.click();
  };

  const openCSVImportPopup = () => {
    // Varje gång popupen öppnas nollställs tidigare importresultat.
    setCSVImportResponse("");
    setCSVImportErrors([]);
    setCSVImportStage("");
    setCSVImportProgress(0);
    setCSVImportProgressText("");
    setShowCSVServerProgress(false);
    setisCSVImportPopupOpen(true);
  };

  const closeCSVImportPopup = () => {
    // Samma reset vid stängning så att nästa importstart alltid sker från rent läge.
    setisCSVImportPopupOpen(false);
    setIsImportingCSV(false);
    setCSVImportResponse("");
    setCSVImportErrors([]);
    setCSVImportStage("");
    setCSVImportProgress(0);
    setCSVImportProgressText("");
    setShowCSVServerProgress(false);
  };

  const handleCSVSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Enkel klientvalidering innan vi börjar belasta backend.
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setCSVImportResponse("Fel: välj en giltig .csv-fil.");
      setCSVImportErrors([]);
      e.target.value = "";
      return;
    }

    setIsImportingCSV(true);
    setCSVImportResponse("");
    setCSVImportErrors([]);
    setCSVImportProgress(0);
    setCSVImportProgressText("");
    setShowCSVServerProgress(false);
    setCSVImportStage("Läser filen...");

    try {
      setCSVImportStage("Skickar till servern...");
      const result = await importHistoricalCSV(file, (progress) => {
        // Fas 1: filen laddas upp till API-routen.
        // Ingen serverprogressbar här, eftersom servern ännu inte validerar/sparar rader.
        if (progress.phase === "uploading") {
          setCSVImportStage("Laddar upp filen...");
          setCSVImportProgress(0);
          setCSVImportProgressText("");
          return;
        }

        const processedRows = progress.processedRows ?? 0;
        const totalRows = progress.totalRows ?? 0;
        // Så snart vi får "validating" eller "inserting" vet vi att serverfasen är igång.
        setShowCSVServerProgress(true);

        if (progress.phase === "validating") {
          // Fas 2: validering får bara 0-5% av baren.
          // Idén är att valideringen ska synas men inte dominera upplevelsen.
          const serverPhaseProgress = Math.round(
            (progress.percentage / 100) * 5,
          );
          setCSVImportProgress(serverPhaseProgress);
          setCSVImportStage("Validerar rader på servern...");
          setCSVImportProgressText(
            `${processedRows} av ${totalRows} rader validerade`,
          );
          return;
        }

        // Fas 3: databasinsättning får 5-100% av baren.
        // Denna del tar normalt längst tid och ska därför få huvuddelen av progressutrymmet.
        const insertPhaseProgress =
          5 + Math.round((progress.percentage / 100) * 95);
        setCSVImportProgress(insertPhaseProgress);
        setCSVImportStage("Sparar rader i databasen...");
        setCSVImportProgressText(
          `${processedRows} av ${totalRows} rader sparade`,
        );
      });
      setShowCSVServerProgress(true);
      setCSVImportProgress(100);
      // Sluttext i progressrutan.
      setCSVImportProgressText("Import slutförd");
      const stats = result.data;

      if (!stats) {
        setCSVImportResponse(
          "Import slutförd, men ingen statistik returnerades.",
        );
      } else {
        setCSVImportResponse(
          `Import klar. Rader i fil: ${stats.rowsFound}, sparade rader: ${stats.insertedRows}.`,
        );
      }
      setCSVImportErrors([]);
    } catch (error) {
      setCSVImportStage("Importen misslyckades.");
      const message = error instanceof Error ? error.message : "Oväntat fel";
      setCSVImportResponse(`Import misslyckades: ${message}`);

      if (error instanceof HistoricalImportError) {
        setCSVImportErrors(error.details);
      } else {
        setCSVImportErrors([]);
      }
    } finally {
      setIsImportingCSV(false);
      // Tillåter att samma fil väljs igen efter en körning.
      e.target.value = "";
    }
  };

  const csvOutputText = csvImportResponse
    ? [
        csvImportResponse,
        ...(csvImportErrors.length > 0
          ? ["", "Detaljer:", ...csvImportErrors]
          : []),
      ].join("\n")
    : "";

  return (
    <div className="min-h-screen flex flex-col bg-[#C6E2D8]">
      {/* Wrapper som tvingar navigationsbaren att alltid ligga FRAMFÖR alla Popuper */}
      <div className="relative z-[60]">
        <Navigation currentPage="admin" />
      </div>

      <main className="flex-grow p-6 flex justify-center">
        <div className="space-y-6 text-gray-800 font-sans w-full max-w-6xl">
          {/* SIDHUVUD & ACTION-KNAPPAR */}
          <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-xl shadow-md">
            <h1 className="text-2xl font-bold text-[#446E30] mb-4 md:mb-0">
              Admin & Strategisk Analys
            </h1>
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={openCSVImportPopup}
                className="px-4 py-2 border-2 border-[#446E30] text-[#446E30] hover:bg-[#e8f1e9] font-semibold rounded transition-colors"
              >
                Ladda upp historisk data
              </button>
              <button
                onClick={() => setIsAddUserOpen(true)}
                className="px-4 py-2 bg-[#75C07A] hover:bg-green-800 text-white font-semibold rounded shadow transition-colors duration-300"
              >
                + Lägg till Användare
              </button>
              <button
                onClick={() => setIsMessagePopupOpen(true)}
                className="px-4 py-2 bg-[#446E30] hover:bg-[#365926] text-white font-semibold rounded shadow transition-colors duration-300"
              >
                ✉ Skicka Meddelande
              </button>
            </div>
          </div>

          {/* INFO rutor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-[#7ec58a]">
              <p className="text-sm text-gray-500 font-medium">
                Fyllnadsgrad Totalt
              </p>
              <p className="text-3xl font-bold mt-1">88%</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-[#446E30]">
              <p className="text-sm text-gray-500 font-medium">
                Snitt Intäkt / FLM
              </p>
              <p className="text-3xl font-bold mt-1">184 kr</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-gray-400">
              <p className="text-sm text-gray-500 font-medium">Aktiva Bilar</p>
              <p className="text-3xl font-bold mt-1">32 st</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-gray-400">
              <p className="text-sm text-gray-500 font-medium">
                Körningar idag
              </p>
              <p className="text-3xl font-bold mt-1">142</p>
            </div>
          </div>

          {/* GRAFER (Placeholders) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-md flex flex-col">
              <h3 className="font-bold mb-4 border-b-2 border-green-500 pb-2">
                Fyllnadsgrad per Distrikt
              </h3>
              <div className="flex-grow bg-gray-50 border-2 border-gray-200 rounded flex flex-col justify-end p-4 min-h-[12rem]">
                <div className="flex items-end justify-around h-full border-b-2 border-gray-300 pb-1">
                  <div
                    className="w-12 sm:w-16 bg-[#7ec58a] h-[80%] rounded-t-sm hover:opacity-80 transition-opacity"
                    title="Växjö: 80%"
                  ></div>
                  <div
                    className="w-12 sm:w-16 bg-[#446E30] h-[60%] rounded-t-sm hover:opacity-80 transition-opacity"
                    title="Linköping: 60%"
                  ></div>
                  <div
                    className="w-12 sm:w-16 bg-[#7ec58a] h-[90%] rounded-t-sm hover:opacity-80 transition-opacity"
                    title="Jönköping: 90%"
                  ></div>
                </div>
                <div className="flex justify-around mt-3">
                  <span className="text-xs sm:text-sm font-bold text-gray-600 w-12 sm:w-16 text-center">
                    Växjö
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-gray-600 w-12 sm:w-16 text-center">
                    Linköping
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-gray-600 w-12 sm:w-16 text-center">
                    Jönköping
                  </span>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-md flex flex-col">
              <h3 className="font-bold mb-4 border-b-2 border-green-500 pb-2">
                Intäkt per FLM
              </h3>
              <div className="flex-grow bg-gray-50 border-2 border-gray-200 rounded flex items-center justify-center text-gray-400 min-h-[12rem]">
                [ Här ska en graf visas senare ]
              </div>
            </div>
          </div>

          {/* TRAFIKLEDARLISTA */}
          <div className="bg-white p-6 rounded-xl shadow-md overflow-hidden">
            <h3 className="font-bold text-lg mb-4 border-b-2 border-green-500 pb-2">
              Trafikledare
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-y-2 border-gray-200">
                    <th className="p-4 font-semibold">Namn / Email</th>
                    <th className="p-4 font-semibold">Distrikt</th>
                    <th className="p-4 font-semibold">Snitt Intäkt/FLM</th>
                    <th className="p-4 font-semibold">Arbetsvolym</th>
                  </tr>
                </thead>
                <tbody>
                  {mockTrafficLeaders.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedUser(user)}
                    >
                      <td className="p-4 text-[#446E30] font-bold">
                        {user.name} <br />
                        <span className="text-sm font-normal text-gray-500">
                          {user.email}
                        </span>
                      </td>
                      <td className="p-4">{user.district}</td>
                      <td className="p-4">{user.kpi}</td>
                      <td className="p-4">{user.arbetsvolym}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* POPUP: LÄGG TILL ANVÄNDARE */}
      {isAddUserOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md relative text-gray-800">
            <button
              onClick={() => setIsAddUserOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-black text-xl"
            >
              ✖
            </button>
            <h3 className="font-bold text-xl mb-6 border-b-2 border-green-500 pb-2">
              Skapa ny användare
            </h3>
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="flex flex-col bg-gray-50 p-3 rounded-lg shadow-sm">
                <input
                  type="email"
                  placeholder="E-mail"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  className="w-full p-2 border-2 border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#7ec58a]"
                />
              </div>

              {/* Uppdaterat fält för lösenord med ögon-ikonen */}
              <div className="flex flex-col bg-gray-50 p-3 rounded-lg shadow-sm">
                <div className="relative">
                  <input
                    type={showSignupPassword ? "text" : "password"}
                    placeholder="Lösenord"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    className="w-full p-2 pr-12 border-2 border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#7ec58a]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPassword(!showSignupPassword)}
                    className="absolute right-3 top-2.5 text-gray-500 hover:text-black transition-colors"
                  >
                    {showSignupPassword ? <EyeSlashIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col bg-gray-50 p-3 rounded-lg shadow-sm">
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full p-2 border-2 border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#7ec58a]"
                >
                  <option value="">Välj roll</option>
                  {Constants.public.Enums["User_specialization_types"].map(
                    (r) => (
                      <option key={r} value={r}>
                        {r === "traffic_leader" ? "Trafikledare" : "Admin"}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <button
                type="submit"
                disabled={isSigningUp}
                className="w-full mt-4 bg-[#75C07A] text-white p-3 rounded font-bold hover:bg-green-800 transition-colors duration-300 disabled:opacity-50"
              >
                {isSigningUp ? "Registrerar..." : "Registrera"}
              </button>
            </form>
            {signupResponse && (
              <p className="mt-4 p-3 bg-gray-100 border-l-4 border-[#75C07A] text-sm rounded">
                {signupResponse}
              </p>
            )}
          </div>
        </div>
      )}

      {/* POPUP: IMPORTERA HISTORISK CSV */}
      {isCSVImportPopupOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-xl relative text-gray-800">
            <button
              onClick={closeCSVImportPopup}
              className="absolute top-4 right-4 text-gray-400 hover:text-black text-xl"
            >
              ✖
            </button>
            <h3 className="font-bold text-xl mb-4 border-b-2 border-green-500 pb-2">
              Importera historisk kusk-data
            </h3>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Välj en .csv-fil med historiska kusk-rader. Importen kör en full
                kontroll, och eventuella fel visas i rutan nedan.
              </p>

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleCSVUploadClick}
                  disabled={isImportingCSV}
                  className="px-6 py-2 bg-[#446E30] hover:bg-[#365926] text-white font-semibold rounded shadow transition-colors duration-300 disabled:opacity-50"
                >
                  {isImportingCSV
                    ? "Importerar CSV..."
                    : "Välj CSV-fil och importera"}
                </button>
              </div>

              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleCSVSelected}
              />

              {showCSVServerProgress && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 space-y-3">
                  <div className="flex items-center gap-3 text-sm text-gray-700">
                    {/* Spinner visas enbart medan importen pågår aktivt. */}
                    {isImportingCSV && (
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#446E30] border-t-transparent" />
                    )}
                    <span>{csvImportStage || "Redo att importera."}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-[#446E30] transition-all duration-150 ease-out"
                        style={{ width: `${csvImportProgress}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{csvImportProgressText}</span>
                      <span>{csvImportProgress}%</span>
                    </div>
                  </div>
                </div>
              )}
              <textarea
                value={csvOutputText}
                readOnly
                className="w-full h-44 p-3 border-2 border-gray-300 rounded bg-white text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* SKICKA MEDDELANDE */}
      {isMessagePopupOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md relative text-gray-800">
            <button
              onClick={() => setIsMessagePopupOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-black text-xl"
            >
              ✖
            </button>
            <h3 className="font-bold text-xl mb-6 border-b-2 border-green-500 pb-2">
              Skicka info till alla
            </h3>
            <form onSubmit={handleSendMessage} className="space-y-4">
              <div className="flex flex-col bg-gray-50 p-3 rounded-lg shadow-sm">
                <textarea
                  value={adminMessage}
                  onChange={(e) => setAdminMessage(e.target.value)}
                  placeholder="Skriv ditt meddelande här..."
                  className="w-full p-2 border-2 border-gray-300 rounded h-32 focus:outline-none focus:ring-2 focus:ring-[#7ec58a]"
                ></textarea>
              </div>
              <button
                type="submit"
                disabled={isSendingMessage}
                className="w-full bg-[#446E30] text-white p-3 rounded font-bold hover:bg-[#365926] transition-colors duration-300 disabled:opacity-50"
              >
                {isSendingMessage ? "Skickar..." : "Skicka"}
              </button>
            </form>
            {adminResponse && (
              <p className="mt-4 p-3 bg-gray-100 border-l-4 border-[#446E30] text-sm rounded">
                {adminResponse}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ANVÄNDARDETALJER */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-sm relative border-t-8 border-[#446E30] text-gray-800">
            <button
              onClick={() => setSelectedUser(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-black text-xl"
            >
              ✖
            </button>
            <h3 className="font-bold text-2xl mb-1">{selectedUser.name}</h3>
            <p className="text-gray-500 mb-6">{selectedUser.email}</p>
            <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
              <p className="flex justify-between">
                <strong>Distrikt:</strong> <span>{selectedUser.district}</span>
              </p>
              <p className="flex justify-between border-y border-gray-200 py-2">
                <strong>Prestanda:</strong>{" "}
                <span className="text-[#446E30] font-bold">
                  {selectedUser.kpi}
                </span>
              </p>
              <p className="flex justify-between">
                <strong>Arbetsvolym:</strong>{" "}
                <span>{selectedUser.arbetsvolym}</span>
              </p>
            </div>
            <button
              onClick={() => setSelectedUser(null)}
              className="mt-8 w-full border-2 border-gray-300 font-bold p-3 rounded hover:bg-gray-100 transition-colors"
            >
              Stäng
            </button>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
