"use client";
import Navigation from "../../components/Navigation";
import Footer from "../../components/Footer";
import { useState, useEffect } from "react";
import { addMessage, signUpProcedure } from "@/lib/api";
import { Enums, Constants, TablesUpdate } from "@/lib/supabaseServerSchema";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { useHistoricalImport } from "./useHistoricalImport";
import { validatePassword } from "@/lib/validation";
import { DEFAULT_AREAS } from "@/lib/areaLineConfig";
import PasswordInput from "../../components/PasswordInput";

// Mock data uppdaterad med "arbetsvolym" istället för status

type TrafficLeader = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: string | null;
  // add any other fields your User table has
};

const formatRole = (role: string | null) => {
  if (role === "admin") return "Admin";
  if (role === "traffic_leader") return "Trafikledare";
  return role ?? "—";
};

export default function Admin() {
  const [trafficLeaders, setTrafficLeaders] = useState<TrafficLeader[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState(""); //For serch
  const [userPage, setUserPage] = useState(1);
  const USERS_PER_PAGE = 5;
  const [editUser, setEditUser] = useState<TrafficLeader | null>(null);
  const [editPassword, setEditPassword] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deleteConfirmUser, setDeleteConfirmUser] =
    useState<TrafficLeader | null>(null);
  const [isDeleteAcknowledged, setIsDeleteAcknowledged] = useState(false);
  const normalize = (str: string) =>
    str.toLowerCase().replace(/\s+/g, " ").trim();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch("/api/users"); // adjust path to match where route.ts lives
        const json = await res.json();
        if (!json.status) throw new Error(json.message);
        setTrafficLeaders(json.data);
      } catch (err) {
        setUsersError((err as Error).message);
      } finally {
        setIsLoadingUsers(false);
      }
    };

    fetchUsers();
  }, []);

  const [lastImport, setLastImport] = useState<string | null>(null);

  useEffect(() => {
    getSupabaseBrowserClient()
      .from("Historical_shipment")
      .select("imported_at")
      .order("imported_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setLastImport(data?.imported_at ?? null));
  }, []);

  // Senaste avräkningsdatumet
  const [lastUploadDate, setLastUploadDate] = useState<string | null>(null);

  // Äldsta avräkningsdatumet
  const [oldestUploadDate, setOldestUploadDate] = useState<string | null>(null);

  useEffect(() => {
    getSupabaseBrowserClient()
      .from("Historical_shipment")
      .select("upload_date")
      .order("upload_date", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setLastUploadDate(data?.upload_date ?? null));
  }, []);

  useEffect(() => {
    getSupabaseBrowserClient()
      .from("Historical_shipment")
      .select("upload_date")
      .order("upload_date", { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setOldestUploadDate(data?.upload_date ?? null));
  }, []);

  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isMessagePopupOpen, setIsMessagePopupOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<TrafficLeader | null>(null);

  const [adminMessage, setAdminMessage] = useState("");
  const [adminResponse, setAdminResponse] = useState("");
  const [isSendingMessage, setIsSending] = useState(false);

  type UserRole = Enums<"User_specialization_types">;
  const [role, setRole] = useState<UserRole | "">("");
  const [signupFirstName, setSignupFirstName] = useState("");
  const [signupLastName, setSignupLastName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [signupResponse, setSignupResponse] = useState("");
  const {
    csvInputRef,
    isCSVImportPopupOpen,
    isImportingCSV,
    csvImportStage,
    csvImportProgress,
    showCSVServerProgress,
    csvOutputText,
    openCSVImportPopup,
    closeCSVImportPopup,
    handleCSVUploadClick,
    handleCSVSelected,
  } = useHistoricalImport();

  // Temporary stuff for name translation matching
  const [isNameTranslationPopupOpen, setIsNameTranslationPopupOpen] = useState(false);
  const [translationStartDate, setTranslationStartDate] = useState("");
  const [translationEndDate, setTranslationEndDate] = useState("");

  function handleReadTranslation() {
    if (!translationStartDate || !translationEndDate) return;
    // call your existing logic here, passing the range
    // e.g. fetchNameTranslations(translationStartDate, translationEndDate)
  }

  const handleUpdateUser = async (user: TrafficLeader) => {
    const trimmedPassword = editPassword.trim();

    if (trimmedPassword && !validatePassword(trimmedPassword)) {
      alert(
        "Lösenordet måste vara minst 7 tecken långt och innehålla minst 1 siffra",
      );
      return;
    }

    setIsSavingEdit(true);

    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          role: user.role,
          newPassword: trimmedPassword || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.status) {
        alert(json.message || "Kunde inte uppdatera användaren");
        return;
      }

      if (json.data) {
        setTrafficLeaders((prev) =>
          prev.map((u) => (u.id === user.id ? json.data : u)),
        );
      }

      setEditUser(null);
      setEditPassword("");
    } finally {
      setIsSavingEdit(false);
    }
  };
  const openDeleteConfirm = (user: TrafficLeader) => {
    setDeleteConfirmUser(user);
    setIsDeleteAcknowledged(false);
  };

  const closeDeleteConfirm = () => {
    setDeleteConfirmUser(null);
    setIsDeleteAcknowledged(false);
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const res = await fetch("/api/users/delete/user", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      });

      const json = await res.json();

      if (!json.status) {
        throw new Error(json.message || "Kunde inte ta bort användaren");
      }

      // Uppdatera UI direkt (optimistic update)
      setTrafficLeaders((prev) => prev.filter((user) => user.id !== userId));
      closeDeleteConfirm();
      setEditUser(null);
      setEditPassword("");
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminMessage.trim()) return;
    setIsSending(true);
    try {
      const data = await addMessage(adminMessage);
      setAdminResponse(data.message);
      setAdminMessage("");
    } catch (error) {
      setAdminResponse("Fel: " + (error as Error).message);
    } finally {
      setIsSending(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields are filled
    if (
      !signupFirstName.trim() ||
      !signupLastName.trim() ||
      !signupEmail.trim() ||
      !signupPassword.trim() ||
      role === ""
    ) {
      setSignupResponse("Alla fält måste vara ifyllda");
      return;
    }

    try {
      const supabase = getSupabaseBrowserClient();
      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;

      // Verify email is valid before signup
      const APIsignUpResponse = await signUpProcedure(signupEmail);
      if (!APIsignUpResponse.status) throw new Error(APIsignUpResponse.message);

      // Validate password requirements
      if (!validatePassword(signupPassword))
        throw new Error(
          "Lösenordet måste vara minst 7 tecken långt och innehålla minst 1 siffra",
        );

      // Create user in Supabase auth
      const { data, error } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: {
          emailRedirectTo: `${siteUrl}/login`,
          data: {
            first_name: signupFirstName.trim(),
          },
        },
      });

      if (error) throw error;
      if (!data.user) throw new Error("Kunde inte skapa användare");

      // Set default user preferences
      const defaultFilters = {
        areas: DEFAULT_AREAS,
        theme: "light",
      };

      // Update user profile with role, name, and preferences
      const userUpdate: TablesUpdate<"User"> = {
        role,
        first_name: signupFirstName.trim(),
        last_name: signupLastName.trim(),
        filters: defaultFilters,
      };

      const { error: updateError } = await supabase
        .from("User")
        .update(userUpdate)
        .eq("id", data.user.id);

      if (updateError) throw updateError;

      // Confirm successful user creation
      setSignupResponse(
        `Skapade användare ${data.user.email}. Ett verifieringsmail har skickats. Kom ihåg att kolla skräpposten.`,
      );
      // Clear form after successful signup
      setSignupFirstName("");
      setSignupLastName("");
      setSignupEmail("");
      setSignupPassword("");
      setRole("");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      setSignupResponse(`Fel vid registrering: ${message}`);
    } finally {
      setIsSigningUp(false);
    }
  };
  const filteredUsers = trafficLeaders.filter((u) => {
    const query = normalize(userSearch);

    const fullName = normalize(`${u.first_name ?? ""} ${u.last_name ?? ""}`);

    const email = normalize(u.email ?? "");

    return fullName.includes(query) || email.includes(query);
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const lastNameCompare = (a.last_name ?? "").localeCompare(
      b.last_name ?? "",
      "sv",
      { sensitivity: "base" },
    );

    if (lastNameCompare !== 0) return lastNameCompare;

    const firstNameCompare = (a.first_name ?? "").localeCompare(
      b.first_name ?? "",
      "sv",
      { sensitivity: "base" },
    );

    if (firstNameCompare !== 0) return firstNameCompare;

    return (a.email ?? "").localeCompare(b.email ?? "", "sv", {
      sensitivity: "base",
    });
  });

  const totalPages = Math.ceil(sortedUsers.length / USERS_PER_PAGE);

  const paginatedUsers = sortedUsers.slice(
    (userPage - 1) * USERS_PER_PAGE,
    userPage * USERS_PER_PAGE,
  );

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <Navigation currentPage="admin" />

      <main className="flex-grow p-6 flex justify-center">
        <div className="space-y-6 text-[var(--text-primary)] font-sans w-full max-w-6xl">
          {/* SIDHUVUD & ACTION-KNAPPAR */}
          <div className="flex flex-col md:flex-row justify-between items-center bg-[var(--primary-element)] p-6 rounded-xl shadow-md">
            <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-4 md:mb-0">
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
                data-testid="signup-button"
                className="px-4 py-2 bg-[#75C07A] hover:bg-green-800 text-[var(--text-primary)] font-semibold rounded shadow transition-colors duration-300"
              >
                + Lägg till Användare
              </button>
              <button
                onClick={() => setIsMessagePopupOpen(true)}
                className="px-4 py-2 bg-[#446E30] hover:bg-[#365926] text-[var(--text-primary)] font-semibold rounded shadow transition-colors duration-300"
              >
                ✉ Skicka Meddelande
              </button>
              <button
                onClick={() => setIsNameTranslationPopupOpen(true)}
                className="px-4 py-2 bg-[#74ED40] hover:bg-[#60C435] text-[var-(--text-primary)] font-semibold rounded shadow transition-colors duration-300"
              >
                Läs in namn
              </button>
            </div>
          </div>

          {/* TRAFIKLEDARLISTA */}

          <div className="bg-[var(--primary-element)] p-6 rounded-xl shadow-md overflow-hidden">
            <h3 className="font-bold text-lg mb-4 border-b-2 border-green-500 pb-2">
              Trafikledare
            </h3>

            <div className="mb-4">
              <input
                type="text"
                value={userSearch}
                onChange={(e) => {
                  setUserSearch(e.target.value);
                  setUserPage(1); // viktigt så man inte fastnar på fel sida
                }}
                placeholder="Sök efter namn eller email..."
                className="w-full p-2 border rounded bg-[var(--input-text)] text-[var(--text-primary)]"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[var(--secondary-element)] border-y-2 border-gray-200">
                    <th className="p-4 font-semibold">Användare</th>
                    <th className="p-4 font-semibold">Roll</th>
                    <th className="p-4 font-semibold">Hantera</th>
                  </tr>
                </thead>

                <tbody>
                  {isLoadingUsers ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="p-4 text-center text-[var(--text-secondary)]"
                      >
                        Laddar användare...
                      </td>
                    </tr>
                  ) : usersError ? (
                    <tr>
                      <td colSpan={3} className="p-4 text-center text-red-500">
                        Fel: {usersError}
                      </td>
                    </tr>
                  ) : trafficLeaders.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="p-4 text-center text-[var(--text-secondary)]"
                      >
                        Inga användare hittades.
                      </td>
                    </tr>
                  ) : (
                    paginatedUsers.map((user) => (
                      <tr
                        key={user.id}
                        className="border-b border-gray-100 hover:bg-[var(--secondary-element)]-50 cursor-pointer transition-colors"
                        onClick={() => setSelectedUser(user)}
                      >
                        <td className="p-4 font-bold">
                          {user.first_name} {user.last_name}
                          <br />
                          <span className="text-sm font-normal text-[var(--text-secondary)]">
                            {user.email}
                          </span>
                        </td>
                        <td className="p-4">{formatRole(user.role)}</td>
                        <td className="p-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditUser(user);
                              setEditPassword("");
                            }}
                            className="px-3 py-1.5 rounded-md border border-[#446E30] text-[#446E30] font-semibold
             hover:bg-[#446E30] hover:text-white transition-colors duration-200"
                          >
                            Ändra
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="flex justify-center items-center gap-4 mt-4">
                <button
                  onClick={() => setUserPage((p) => Math.max(p - 1, 1))}
                  disabled={userPage === 1}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Föregående
                </button>

                <span className="text-sm">
                  Sida {userPage} av {totalPages || 1}
                </span>

                <button
                  onClick={() =>
                    setUserPage((p) => Math.min(p + 1, totalPages))
                  }
                  disabled={userPage === totalPages || totalPages === 0}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Nästa
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* POPUP: LÄGG TILL ANVÄNDARE */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-[120] bg-black/45 flex items-center justify-center p-4">
          <div className="bg-[var(--primary-element)] p-8 rounded-xl shadow-xl w-full max-w-md relative text-[var(--text-primary)]">
            <button
              onClick={() => setIsAddUserOpen(false)}
              data-testid="close-signup-window"
              className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-black text-xl"
            >
              ✖
            </button>
            <h3 className="font-bold text-xl mb-6 border-b-2 border-[var(--primary-color)] pb-2">
              Skapa ny användare
            </h3>
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="">
                  <input
                    type="text"
                    placeholder="Förnamn"
                    value={signupFirstName}
                    onChange={(e) => setSignupFirstName(e.target.value)}
                    data-testid="signup-set-first-name"
                    className="bg-[var(--input-text)] text-[var(--text-primary)] focus:outline-none rounded p-2 w-full"
                  />
                </div>
                <div className="">
                  <input
                    type="text"
                    placeholder="Efternamn"
                    value={signupLastName}
                    onChange={(e) => setSignupLastName(e.target.value)}
                    data-testid="signup-set-last-name"
                    className="bg-[var(--input-text)] text-[var(--text-primary)] focus:outline-none rounded p-2 w-full"
                  />
                </div>
              </div>

              <div className="">
                <input
                  type="text"
                  placeholder="E-mail"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  data-testid="signup-set-email"
                  className="bg-[var(--input-text)] text-[var(--text-primary)] focus:outline-none rounded p-2 w-full"
                />
              </div>

              {/* Fält för lösenord med den nya komponenten */}
              <div className="">
                <PasswordInput
                  placeholder="Lösenord"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  data-testid="signup-set-password"
                  className="bg-[var(--input-text)] text-[var(--text-primary)] focus:outline-none p-2"
                />
              </div>

              <div className="">
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  data-testid="signup-set-role"
                  className="bg-[var(--input-text)] text-[var(--text-secondary)] focus:outline-none rounded p-2 w-full"
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
                data-testid="signup-submit-button"
                className="w-full mt-4 bg-[var(--button-submit)] text-[var(--text-primary)] p-3 rounded font-bold hover:bg-[var(--button-submit-hover)] transition-colors duration-300 disabled:opacity-50"
              >
                {isSigningUp ? "Registrerar..." : "Registrera"}
              </button>
            </form>
            {signupResponse && (
              <p
                data-testid="signup-response"
                className="mt-4 p-3 bg-[var(--secondary-element)]-100 border-l-4 border-[#75C07A]  text-sm rounded"
              >
                {signupResponse}
              </p>
            )}
          </div>
        </div>
      )}

      {/* POPUP: IMPORTERA HISTORISK CSV */}
      {isCSVImportPopupOpen && (
        <div className="fixed inset-0 z-[120] bg-black/45 flex items-center justify-center p-4">
          <div className="bg-[var(--primary-element)] p-8 rounded-xl shadow-xl w-full max-w-xl relative text-[var(--text-secondary)]">
            <button
              onClick={closeCSVImportPopup}
              className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-black text-xl"
            >
              ✖
            </button>
            <h3 className="font-bold text-xl mb-4 border-b-2 border-green-500 pb-2">
              Importera historisk kusk-data
            </h3>
            <div className="space-y-4">
              <p className="text-sm text-[var(--text-secondary)]">
                Välj en .csv-fil med historiska kusk-rader. Importen kör en full
                kontroll, och eventuella fel visas i rutan nedan.
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                <span>
                  Senaste importen skedde <b>{lastImport ? new Date(lastImport).toLocaleString("sv-SE") : "Hämtar data..."}</b>
                </span>
                <br/>
                <span>
                  och täcker sändelser med avräkningsdatum fram till <b>{lastUploadDate ? new Date(lastUploadDate).toLocaleString("sv-SE") : "Hämtar data..."}</b>.
                </span>
              </p>

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleCSVUploadClick}
                  disabled={isImportingCSV}
                  className="px-6 py-2 bg-[#446E30] hover:bg-[#365926] text-[var(--text-primary)] font-semibold rounded shadow transition-colors duration-300 disabled:opacity-50"
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
                <div className="rounded-lg border border-gray-200 bg-[var(--secondary-element)]-50 px-4 py-3 space-y-3">
                  <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
                    <div className="flex items-center gap-3">
                      {isImportingCSV && (
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#446E30] border-t-transparent" />
                      )}
                      <span>{csvImportStage || "Redo att importera."}</span>
                    </div>
                    <span className="font-medium">{csvImportProgress}%</span>
                  </div>
                  <div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--secondary-element)]-200">
                      <div
                        className="h-full rounded-full bg-[#446E30] transition-all duration-150 ease-out"
                        style={{ width: `${csvImportProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
              <textarea
                value={csvOutputText}
                readOnly
                className="w-full h-44 p-3 border-2 border-gray-300 rounded bg-[var(--primary-element)] text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* SKICKA MEDDELANDE */}
      {isMessagePopupOpen && (
        <div className="fixed inset-0 z-[120] bg-black/45 flex items-center justify-center p-4">
          <div className="bg-[var(--primary-element)] p-8 rounded-xl shadow-xl w-full max-w-md relative text-[var(--text-secondary)]">
            <button
              onClick={() => setIsMessagePopupOpen(false)}
              className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-black text-xl"
            >
              ✖
            </button>
            <h3 className="font-bold text-xl mb-6 border-b-2 border-green-500 pb-2">
              Skicka info till alla
            </h3>
            <form onSubmit={handleSendMessage} className="space-y-4">
              <div className="flex flex-col bg-[var(--secondary-element)]-50 p-3 rounded-lg shadow-sm">
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
                className="w-full bg-[#446E30] text-[var(--text-primary)] p-3 rounded font-bold hover:bg-[#365926] transition-colors duration-300 disabled:opacity-50"
              >
                {isSendingMessage ? "Skickar..." : "Skicka"}
              </button>
            </form>
            {adminResponse && (
              <p className="mt-4 p-3 bg-[var(--secondary-element)]-100 border-l-4 border-[#446E30] text-sm rounded">
                {adminResponse}
              </p>
            )}
          </div>
        </div>
      )}
      {editUser && (
        <div className="fixed inset-0 z-[120] bg-black/45 flex items-center justify-center p-4">
          <div className="bg-[var(--primary-element)] p-8 rounded-xl shadow-xl w-full max-w-md relative text-[var(--text-primary)]">
            <button
              onClick={() => {
                setEditUser(null);
                setEditPassword("");
              }}
              className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-black text-xl"
            >
              ✖
            </button>

            <h3 className="font-bold text-xl mb-6 border-b-2 border-[var(--primary-color)] pb-2">
              Redigera användare
            </h3>

            <div className="space-y-4">
              {/* Förnamn */}
              <label className="block text-sm font-medium mb-1">Förnamn</label>
              <input
                className="w-full rounded-lg p-2.5 bg-[var(--input-text)] border border-gray-300 dark:border-gray-600 focus:outline-none focus.ring-2 focus:ring-[#75C07A] transition"
                value={editUser.first_name ?? ""}
                onChange={(e) =>
                  setEditUser((prev) =>
                    prev ? { ...prev, first_name: e.target.value } : prev,
                  )
                }
                placeholder="Förnamn"
              />

              {/* Efternamn */}
              <label className="block text-sm font-medium mb-1">
                Efternamn
              </label>
              <input
                className="w-full rounded-lg p-2.5 bg-[var(--input-text)] border border-gray-300 dark:border-gray-600 focus:outline-none focus.ring-2 focus:ring-[#75C07A] transition"
                value={editUser.last_name ?? ""}
                onChange={(e) =>
                  setEditUser((prev) =>
                    prev ? { ...prev, last_name: e.target.value } : prev,
                  )
                }
                placeholder="Efternamn"
              />

              {/* Email */}
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                className="w-full rounded-lg p-2.5 bg-[var(--input-text)] border border-gray-300 dark:border-gray-600 focus:outline-none focus.ring-2 focus:ring-[#75C07A] transition"
                value={editUser.email ?? ""}
                onChange={(e) =>
                  setEditUser((prev) =>
                    prev ? { ...prev, email: e.target.value } : prev,
                  )
                }
                placeholder="Email"
              />

              {/* Roll */}
              <label className="block text-sm font-medium mb-1">Roll</label>
              <select
                value={editUser.role ?? ""}
                onChange={(e) =>
                  setEditUser((prev) =>
                    prev ? { ...prev, role: e.target.value } : prev,
                  )
                }
                className="w-full rounded-lg p-2.5 bg-[var(--input-text)] border border-gray-300 dark:border-gray-600 focus:outline-none focus.ring-2 focus:ring-[#75C07A] transition"
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

              {/* Lösenord */}
              <label className="block text-sm font-medium mb-1">Lösenord</label>
              <PasswordInput
                placeholder="Nytt lösenord"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                data-testid="edit-set-password"
                className="bg-[var(--input-text)] border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-[#75C07A] transition p-2.5 rounded-lg"
              />
              <p className="text-xs text-[var(--text-secondary)]">
                Lämna tomt för att behålla nuvarande lösenord.
              </p>

              {/* ACTIONS */}
              <div className="flex justify-between pt-4">
                <button
                  className="px-4 py-2 rounded border border-red-300 text-red-500 font-semibold hover:bg-red-50 transition"
                  onClick={() => openDeleteConfirm(editUser)}
                >
                  Radera användare
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditUser(null);
                      setEditPassword("");
                    }}
                    className="px-4 py-2 rounded border"
                  >
                    Avbryt
                  </button>

                  <button
                    disabled={isSavingEdit}
                    className="px-4 py-2 rounded bg-[#75C07A] hover:bg-green-800 text-white font-semibold transition disabled:opacity-50"
                    onClick={() => handleUpdateUser(editUser)}
                  >
                    {isSavingEdit ? "Sparar..." : "Spara"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmUser && (
        <div className="fixed inset-0 z-[130] bg-black/55 flex items-center justify-center p-4">
          <div className="bg-[var(--primary-element)] p-6 rounded-xl shadow-xl w-full max-w-md relative text-[var(--text-primary)] border border-red-200">
            <button
              onClick={closeDeleteConfirm}
              className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-black text-xl"
            >
              ✖
            </button>

            <h3 className="font-bold text-xl mb-3 border-b-2 border-red-500 pb-2 text-red-700">
              Är du säker?
            </h3>

            <p className="text-sm text-[var(--text-secondary)] leading-6 mb-4">
              Om du tar bort {deleteConfirmUser.first_name}{" "}
              {deleteConfirmUser.last_name} försvinner användaren och all
              tillhörande information direkt. Det här går inte att ångra.
            </p>

            <label className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50/70 p-3 text-sm text-[var(--text-primary)] cursor-pointer">
              <input
                type="checkbox"
                checked={isDeleteAcknowledged}
                onChange={(e) => setIsDeleteAcknowledged(e.target.checked)}
                className="mt-1 h-4 w-4 accent-red-600"
              />
              <span>
                Jag förstår att detta tar bort användaren permanent och att det
                inte går att få tillbaka.
              </span>
            </label>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={closeDeleteConfirm}
                className="px-4 py-2 rounded border border-gray-300 font-semibold hover:bg-[var(--secondary-element)] transition"
              >
                Avbryt
              </button>
              <button
                onClick={() => handleDeleteUser(deleteConfirmUser.id)}
                disabled={!isDeleteAcknowledged}
                className="px-4 py-2 rounded bg-red-600 text-white font-semibold hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Radera permanent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ANVÄNDARDETALJER */}
      {selectedUser && (
        <div className="fixed inset-0 z-[120] bg-black/45 flex items-center justify-center p-4">
          <div className="bg-[var(--primary-element)] p-8 rounded-xl shadow-xl w-full max-w-sm relative border-t-8 border-[#446E30] text-[var(--text-secondary)]">
            <button
              onClick={() => setSelectedUser(null)}
              className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-black text-xl"
            >
              ✖
            </button>
            <h3 className="font-bold text-2xl mb-1">
              {selectedUser.first_name} {selectedUser.last_name}
            </h3>
            <p className="text-[var(--text-secondary)] mb-6">
              {selectedUser.email}
            </p>
            <div className="space-y-3 bg-[var(--secondary-element)]-50 p-4 rounded-lg">
              <p className="flex justify-between">
                <strong>Roll:</strong>{" "}
                <span>{formatRole(selectedUser.role)}</span>
              </p>
            </div>
            <button
              onClick={() => setSelectedUser(null)}
              className="mt-8 w-full border-2 border-gray-300 font-bold p-3 rounded hover:bg-[var(--secondary-element)]-100 transition-colors"
            >
              Stäng
            </button>
          </div>
        </div>
      )}

      {/* Namnöversättning */}
      {isNameTranslationPopupOpen && (
        <div className="fixed inset-0 z-[120] bg-black/45 flex items-center justify-center p-4">
          <div className="bg-[var(--primary-element)] p-8 rounded-xl shadow-xl w-full max-w-md relative text-[var(--text-secondary)]">
            <button
              onClick={() => setIsNameTranslationPopupOpen(false)}
              className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-black text-xl"
            >
              ✖
            </button>
            <h3 className="font-bold text-xl mb-6 border-b-2 border-green-500 pb-2">
              Temporär namnöversättningstabellsgenerator
            </h3>
            <p className="mb-4">
              KUSK-data i databasen täcker avräkningsdatumen{" "}
              <b>
                {oldestUploadDate ? new Date(oldestUploadDate).toLocaleString("sv-SE") : "Hämtar data..."} -{" "}
                {lastUploadDate ? new Date(lastUploadDate).toLocaleString("sv-SE") : "Hämtar data..."}
              </b>
            </p>

            <div className="grid grid-cols-2 gap-3 mb-2">
              <div className="space-y-1">
                <label
                  htmlFor="translationStartDate"
                  className="block text-sm font-medium text-[var(--text-primary)]"
                >
                  Från datum
                </label>
                <input
                  id="translationStartDate"
                  type="date"
                  value={translationStartDate}
                  max={translationEndDate || undefined}
                  onChange={(e) => setTranslationStartDate(e.target.value)}
                  className="w-full text-[var(--text-primary)] border-2 border-[var(--border-primary)] rounded p-2 focus:outline-none focus:ring-2 focus:ring-green-700"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="translationEndDate"
                  className="block text-sm font-medium text-[var(--text-primary)]"
                >
                  Till datum
                </label>
                <input
                  id="translationEndDate"
                  type="date"
                  value={translationEndDate}
                  min={translationStartDate || undefined}
                  onChange={(e) => setTranslationEndDate(e.target.value)}
                  className="w-full text-[var(--text-primary)] border-2 border-[var(--border-primary)] rounded p-2 focus:outline-none focus:ring-2 focus:ring-green-700"
                />
              </div>
            </div>

            <button
              onClick={handleReadTranslation}
              disabled={!translationStartDate || !translationEndDate}
              className="mt-4 w-full py-2 rounded-lg bg-green-600 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Läs
            </button>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
