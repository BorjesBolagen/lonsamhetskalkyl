"use client";
import Navigation from "../../components/Navigation";
import Footer from "../../components/Footer";
import PasswordInput from "../../components/PasswordInput";
import { getCurrentlySignedInUser, setFilters, setPassword } from "../../lib/api";
import {
  AREA_KEYS,
  AREA_OPTIONS,
  AreaKey,
  AreaState,
  DEFAULT_AREAS,
  parseAreaState,
} from "../../lib/areaLineConfig";
import { Json } from "../../lib/supabaseServerSchema";
import { useEffect, useMemo, useState } from "react";
import { DEFAULT_PROFITABILITY_REFERENCE_VALUE, DEFAULT_MILE_COST } from "../../lib/backend/constants";
import { parseMileCostReferenceValue } from "../../lib/backend/transportPlanningUtils";
import { validatePassword } from "@/lib/validation";

type ThemeMode = "light" | "dark";

function applyThemeToDOM(theme: ThemeMode) {
  document.documentElement.setAttribute("data-theme", theme);
  document.cookie = `theme=${theme}; path=/; max-age=31536000`;
  localStorage.setItem("theme", theme);
}

const DEFAULT_THEME: ThemeMode = "light";

function resolveInitialTheme(): ThemeMode {
  if (typeof document !== "undefined") {
    const domTheme = document.documentElement.getAttribute("data-theme");
    if (domTheme === "light" || domTheme === "dark") {
      return domTheme;
    }

    const storedTheme = localStorage.getItem("theme");
    if (storedTheme === "light" || storedTheme === "dark") {
      return storedTheme;
    }

    const cookieTheme = document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("theme="))
      ?.split("=")[1];

    if (cookieTheme === "light" || cookieTheme === "dark") {
      return cookieTheme;
    }
  }

  return DEFAULT_THEME;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseTheme(filters: unknown): ThemeMode {
  if (
    isPlainObject(filters) &&
    (filters.theme === "light" || filters.theme === "dark")
  ) {
    return filters.theme;
  }

  return DEFAULT_THEME;
}

function parseProfitabilityReferenceValue(filters: unknown): number {
  if (
    isPlainObject(filters) &&
    typeof filters.profitabilityReferenceValue === "number" &&
    Number.isFinite(filters.profitabilityReferenceValue) &&
    filters.profitabilityReferenceValue >= 0
  ) {
    return filters.profitabilityReferenceValue;
  }

  return DEFAULT_PROFITABILITY_REFERENCE_VALUE;
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<"konto" | "losenord">("konto");

  // States för formulären
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Password requirement tracking
  const [passwordRequirements, setPasswordRequirements] = useState({
    hasMinLength: false,
    hasDigit: false,
  });

  // Update password requirements dynamically as user types
  const updatePasswordRequirements = (pwd: string) => {
    setPasswordRequirements({
      hasMinLength: pwd.length >= 7,
      hasDigit: /\d/.test(pwd),
    });
  };

  // Generate dynamic requirement message showing only unfulfilled criteria
  const passwordRequirementMessage =
    !passwordRequirements.hasMinLength && !passwordRequirements.hasDigit
      ? "Behöver minst 7 tecken och minst 1 siffra."
      : !passwordRequirements.hasMinLength
        ? "Behöver minst 7 tecken."
        : !passwordRequirements.hasDigit
          ? "Behöver minst 1 siffra."
          : "";

  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("-");
  const [email, setEmail] = useState("-");
  const [role, setRole] = useState("-");
  const [storedFilters, setStoredFilters] = useState<Record<string, unknown>>(
    {},
  );
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingFilters, setIsSavingFilters] = useState(false);
  const [filtersStatus, setFiltersStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // States för områden
  const [districts, setDistricts] = useState<AreaState>(DEFAULT_AREAS);
  // What is currently active in the app
  const [appliedTheme, setAppliedTheme] =
    useState<ThemeMode>(resolveInitialTheme);
  // What the user is editing (draft)
  const [draftTheme, setDraftTheme] = useState<ThemeMode>(DEFAULT_THEME);
  const [profitabilityReferenceValue, setProfitabilityReferenceValue] =
    useState<number | "">(DEFAULT_PROFITABILITY_REFERENCE_VALUE);
  const [mileCostReferenceValue, setMileCostReferenceValue] =
    useState<number>(DEFAULT_MILE_COST);

  const clusterGroups = useMemo(() => {
    const sortedKeys = [...AREA_KEYS].sort((a, b) =>
      AREA_OPTIONS[a].localeCompare(AREA_OPTIONS[b], "sv"),
    );

    return {
      sml: sortedKeys.filter((key) =>
        AREA_OPTIONS[key].toUpperCase().startsWith("SML-"),
      ),
      ahl: sortedKeys.filter((key) =>
        AREA_OPTIONS[key].toUpperCase().startsWith("AHL-"),
      ),
      other: sortedKeys.filter((key) => {
        const value = AREA_OPTIONS[key].toUpperCase();
        return !value.startsWith("SML-") && !value.startsWith("AHL-");
      }),
    };
  }, []);

  const renderClusterToggle = (distKey: AreaKey) => {
    return (
      <label
        key={distKey}
        className="flex items-center justify-between cursor-pointer py-1.5 w-full hover:bg-[var(--text-hover)] transition-colors px-2 rounded"
      >
        <span className="font-bold text-base">{AREA_OPTIONS[distKey]}</span>
        <div className="relative flex items-center">
          <input
            type="checkbox"
            checked={districts[distKey]}
            onChange={() => {
              setDistricts({
                ...districts,
                [distKey]: !districts[distKey],
              });
              setHasUnsavedChanges(true);
            }}
            className="w-6 h-6 appearance-none border-2 border-[var(--secondary-element)] bg-[var(--primary-element)] checked:bg-[var(--primary-element)] rounded-sm cursor-pointer"
          />
          {districts[distKey] && (
            <span className="absolute inset-0 flex items-center justify-center text-[var(--text-primary)] pointer-events-none pb-1 font-bold text-lg">
              x
            </span>
          )}
        </div>
      </label>
    );
  };

  useEffect(() => {
    // For dark/lightmode
    applyThemeToDOM(appliedTheme);
  }, [appliedTheme]);

  useEffect(() => {
    // Profile info + saved filter/theme preferences from Supabase.
    async function loadCurrentUser() {
      try {
        setIsLoadingProfile(true);
        const response = await getCurrentlySignedInUser();
        const user = response.data;

        if (!user) {
          setFiltersStatus({
            type: "error",
            message: "Kunde inte hämta användarprofil.",
          });
          return;
        }

        const firstName = user.first_name?.trim() ?? "";
        const lastName = user.last_name?.trim() ?? "";
        const fullName = [firstName, lastName].filter(Boolean).join(" ");

        setUserId(user.id);
        setDisplayName(fullName || user.email);
        setEmail(user.email);
        setRole(user.role === "admin" ? "Admin" : "Trafikledare");

        if (isPlainObject(user.filters)) {
          setStoredFilters(user.filters);
        } else {
          setStoredFilters({});
        }

        setDistricts(parseAreaState(user.filters));

        const dbTheme = parseTheme(user.filters);
        setAppliedTheme(dbTheme);
        setDraftTheme(dbTheme);

        setProfitabilityReferenceValue(
          parseProfitabilityReferenceValue(user.filters),
        );

        setMileCostReferenceValue(parseMileCostReferenceValue(user.filters));
      } catch (error) {
        setFiltersStatus({
          type: "error",
          message: "Kunde inte ladda dina inställningar.",
        });
      } finally {
        setIsLoadingProfile(false);
      }
    }

    loadCurrentUser();
  }, []);

  // Warn user if refreshing after changed settings
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      e.preventDefault();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  const handleSaveSettings = async () => {
    if (!userId) {
      setFiltersStatus({
        type: "error",
        message: "Ingen användare hittades att spara för.",
      });
      return;
    }

    try {
      setIsSavingFilters(true);
      setFiltersStatus(null);

      // Om rutan är tom eller mindre än noll när man klickar spara, sätt den till 0
      const validReferenceValue =
        profitabilityReferenceValue === "" || profitabilityReferenceValue < 0
          ? 0
          : profitabilityReferenceValue;

      // Keep other filter fields and only overwrite areas + theme from this form.
      const nextFilters: Record<string, unknown> = {
        ...storedFilters,
        areas: districts,
        theme: draftTheme,
        profitabilityReferenceValue: validReferenceValue,
        mileCostReferenceValue,
      };

      await setFilters(userId, nextFilters as Json);
      setAppliedTheme(draftTheme);
      setStoredFilters(nextFilters);
      setFiltersStatus({ type: "success", message: "Inställningar sparade." });
      setHasUnsavedChanges(false);
    } catch (error) {
      setFiltersStatus({
        type: "error",
        message: "Kunde inte spara inställningar.",
      });
    } finally {
      setIsSavingFilters(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus(null);

    // Validate all password fields filled
    if (!currentPassword || !newPassword || !repeatPassword) {
      setPasswordStatus({
        type: "error",
        message: "Fyll i alla lösenordsfält.",
      });
      return;
    }

    // Validate new passwords match
    if (newPassword !== repeatPassword) {
      setPasswordStatus({
        type: "error",
        message: "De nya lösenorden matchar inte.",
      });
      return;
    }

    // Validate password requirements
    if (!validatePassword(newPassword)) {
      setPasswordStatus({
        type: "error",
        message:
          "Lösenordet måste vara minst 7 tecken långt och innehålla minst 1 siffra.",
      });
      return;
    }

    try {
      setIsSavingPassword(true);
      // Call API to update password with current password verification
      const response = await setPassword(currentPassword, newPassword);
      setPasswordStatus({ type: "success", message: response.message });
      // Clear form after successful update
      setCurrentPassword("");
      setNewPassword("");
      setRepeatPassword("");
    } catch (error) {
      setPasswordStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Kunde inte uppdatera lösenordet.",
      });
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <Navigation
        currentPage="settings"
        hasUnsavedChanges={hasUnsavedChanges}
      />

      <main className="flex-grow flex flex-col p-6 items-center">
        {/* Yttre container, max-w-lg gör lådan lagom snäv (inget onödigt vitt utrymme) */}
        <div className="font-sans text-[var(--text-secondary)] w-full max-w-6xl">
          <h1 className="text-4xl text-[var(--text-primary)] font-bold text-center mb-8">
            Mitt Konto
          </h1>

          {/* TOPPMENY (Flikar) */}
          <div className="flex justify-center gap-4 mb-2">
            {/* KONTO-FLIKEN */}
            <button
              onClick={() => setActiveTab("konto")}
              className={`flex items-center justify-center space-x-2 px-6 py-3 rounded-t-lg text-lg font-bold transition-colors min-w-[160px] border-b-4 ${
                activeTab === "konto"
                  ? "bg-[var(--primary-element)] border-[#446E30]"
                  : "bg-transparent border-transparent hover:bg-[var(--secondary-element)]"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span>Konto</span>
            </button>

            {/* LÖSENORD-FLIKEN */}
            <button
              onClick={() => setActiveTab("losenord")}
              className={`flex items-center justify-center space-x-2 px-6 py-3 rounded-t-lg text-lg font-bold transition-colors min-w-[160px] border-b-4 ${
                activeTab === "losenord"
                  ? "bg-[var(--primary-element)] border-[#446E30]"
                  : "bg-transparent border-transparent hover:bg-[var(--secondary-element)]"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              <span>Lösenord</span>
            </button>
          </div>

          {/* HUVUDINNEHÅLL */}
          <section className="bg-[var(--primary-element)] rounded-xl shadow-md p-8 sm:p-10 min-h-[450px]">
            {/* INNEHÅLL: KONTO (Kombinerad info och inställningar) */}
            {activeTab === "konto" && (
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-6">
                    {/* DEL 1: Kontoinformation (Read-only) */}
                    <div>
                      <h3 className="font-bold text-xl mb-4 border-b-2 border-[var(--primary-color)] pb-2">
                        Din Profil
                      </h3>
                      <div className="bg-[var(--secondary-element)] p-5 rounded-lg space-y-3">
                        <div className="flex justify-between items-center border-b border-[var(--seperating-gray)] pb-2">
                          <span className="text-[var(--text-primary)] font-bold">
                            Användare:
                          </span>
                          <span className="font-medium">{displayName}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-[var(--seperating-gray)] pb-2">
                          <span className="text-[var(--text-primary)] font-bold">
                            E-post:
                          </span>
                          <span className="font-medium">{email}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[var(--text-primary)] font-bold">
                            Roll:
                          </span>
                          <span className="bg-[var(--primary-element)] text-[var(--text-primary)] px-3 py-1 rounded-full text-sm font-bold">
                            {role}
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* DEL 3: Tema (Interaktiv) */}
                    <div>
                      <h3 className="font-bold text-xl mb-4 border-b-2 border-[var(--primary-color)] pb-2">
                        Tema
                      </h3>
                      <div className="flex space-x-4">
                        <button
                          onClick={() => {
                            setDraftTheme("light");
                            setHasUnsavedChanges(true);
                          }}
                          className={`flex-1 font-bold py-3 px-6 rounded-lg shadow-sm border transition-transform active:scale-95 ${
                            draftTheme === "light"
                              ? "bg-[var(--button-fetch)] text-[var(--text-primary)] border-[var(--text-primary)]"
                              : "bg-[var(--primary-element)] text-[var(--text-primary)] border-[var(--seperating-gray)]"
                          }`}
                        >
                          Light
                        </button>

                        <button
                          onClick={() => {
                            setDraftTheme("dark");
                            setHasUnsavedChanges(true);
                          }}
                          className={`flex-1 font-bold py-3 px-6 rounded-lg shadow-sm border transition-transform active:scale-95 ${
                            draftTheme === "dark"
                              ? "bg-[var(--button-fetch)] text-[var(--text-primary)] border-[var(--text-primary)]"
                              : "bg-[var(--primary-element)] text-[var(--text-primary)] border-[var(--seperating-gray)]"
                          }`}
                        >
                          Dark
                        </button>
                      </div>
                    </div>

                    {/* DEL 4: Prisreferens för Home */}
                    <div>
                      <h3 className="font-bold text-xl mb-4 border-b-2 border-[var(--primary-color)] pb-2">
                        Referensvärde för prisbar
                      </h3>
                      <div className="bg-[var(--secondary-element)] rounded-lg p-4 space-y-2">
                        <label
                          htmlFor="profitabilityReferenceValue"
                          className="block text-sm font-medium text-[var(--text-primary)]"
                        >
                          Värde som motsvarar 100% i prisbaren
                        </label>
                        <input
                          id="profitabilityReferenceValue"
                          type="number"
                          step={100}
                          min={0}
                          value={profitabilityReferenceValue}
                          onKeyDown={(e) => {
                            // Förhindra inmatning av minus-tecken (både vanliga och på numpad, samt plusstecken)
                            if (
                              e.key === "-" ||
                              e.key === "Subtract" ||
                              e.key === "+" ||
                              e.key === "Add"
                            ) {
                              e.preventDefault();
                            }
                          }}
                          onChange={(e) => {
                            // Tillåt fältet att vara tomt när användaren suddar
                            if (e.target.value === "") {
                              setProfitabilityReferenceValue("");
                              return;
                            }

                            const parsed = Number(e.target.value);

                            // Ignorerar knapptrycket om de försöker skriva ett minustal
                            if (parsed < 0) return;

                            setProfitabilityReferenceValue(parsed);
                          }}
                          className="w-full p-3 border-2 border-[var(--input-border)] rounded focus:outline-none focus:ring-2 focus:ring-[#7ec58a]"
                        />
                      </div>
                    </div>
                    {/* DEL 5: Milpris för simulator */}
                    <div>
                      <h3 className="font-bold text-xl mb-4 border-b-2 border-[var(--primary-color)] pb-2">
                        Milkostnad för simulator
                      </h3>
                      <div className="bg-[var(--secondary-element)] rounded-lg p-4 space-y-2">
                        <label
                          htmlFor="mileCostReferenceValue"
                          className="block text-sm font-medium text-[var(--text-primary)]"
                        ></label>
                        <input
                          id="mileCostReferenceValue"
                          type="number"
                          step={5}
                          value={mileCostReferenceValue}
                          onChange={(e) => {
                            const parsed = Number(e.target.value);
                            setMileCostReferenceValue(
                              Number.isFinite(parsed) && parsed > 0
                                ? parsed
                                : DEFAULT_MILE_COST,
                            );
                            setHasUnsavedChanges(true);
                          }}
                          className="w-full p-3 border-2 border-[var(--input-border)] rounded focus:outline-none focus:ring-2 focus:ring-[#7ec58a]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* DEL 2: Områden (Interaktiv) */}
                  <div>
                    <h3 className="font-bold text-xl mb-4 border-b-2 border-[var(--primary-color)] pb-2">
                      Filtrera dina kluster
                    </h3>
                    {isLoadingProfile && (
                      <p className="text-sm text-gray-600 mb-3">
                        Laddar sparade inställningar...
                      </p>
                    )}
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-[var(--secondary-element)] rounded-lg p-4 space-y-3">
                          <h4 className="font-bold text-lg text-[var(--text-primary)] border-b-2 border-[var(--primary-color)] pb-2">
                            SML kluster
                          </h4>
                          <div className="space-y-2">
                            {clusterGroups.sml.map((distKey) =>
                              renderClusterToggle(distKey),
                            )}
                          </div>
                        </div>

                        <div className="bg-[var(--secondary-element)] rounded-lg p-4 space-y-3">
                          <h4 className="font-bold text-lg text-[var(--text-primary)] border-b-2 border-[var(--primary-color)] pb-2">
                            AHL kluster
                          </h4>
                          <div className="space-y-2">
                            {clusterGroups.ahl.map((distKey) =>
                              renderClusterToggle(distKey),
                            )}
                          </div>

                          <div className="pt-2">
                            <h4 className="font-bold text-lg text-[var(--text-primary)] border-b-2 border-[var(--primary-color)] pb-2">
                              Övriga kluster
                            </h4>
                            <div className="space-y-2 pt-1">
                              {clusterGroups.other.map((distKey) =>
                                renderClusterToggle(distKey),
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--seperating-gray)] flex flex-col gap-3">
                  <button
                    onClick={handleSaveSettings}
                    disabled={isLoadingProfile || isSavingFilters}
                    className="w-full bg-[var(--button-submit)] hover:bg-[var(--button-submit-hover)] disabled:bg-gray-400 text-white font-bold py-4 px-6 rounded-lg transition-colors duration-300 text-lg shadow-md"
                  >
                    {isSavingFilters ? "Sparar..." : "Spara inställningar"}
                  </button>

                  {filtersStatus && (
                    <span
                      className={`text-sm font-medium ${filtersStatus.type === "success" ? "text-green-700" : "text-red-700"}`}
                    >
                      {filtersStatus.message}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* INNEHÅLL: LÖSENORD */}
            {activeTab === "losenord" && (
              <div className="w-full mx-auto text-[var(--text-primary)]">
                <h3 className="font-bold text-xl mb-6 text-center border-b-2 border-[var(--primary-color)] pb-2">
                  Byt lösenord
                </h3>
                <form className="space-y-6" onSubmit={handleSavePassword}>
                  <div className="bg-[var(--secondary-element)] flex flex-col p-4 rounded-lg shadow-sm">
                    <label className="mb-2 text-sm font-bold">
                      Nuvarande lösenord
                    </label>
                    <PasswordInput
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="bg-[var(--input-text)] text-[var(--text-primary)] focus:outline-none p-3"
                    />
                  </div>

                  <div className="bg-[var(--secondary-element)] flex flex-col p-4 rounded-lg shadow-sm">
                    <label className="mb-2 text-sm font-bold">
                      Nytt lösenord
                    </label>
                    <PasswordInput
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        updatePasswordRequirements(e.target.value);
                      }}
                      className="bg-[var(--input-text)] text-[var(--text-primary)] focus:outline-none p-3"
                    />
                  </div>

                  <div className="bg-[var(--secondary-element)] flex flex-col p-4 rounded-lg shadow-sm">
                    <label className="mb-2 text-sm font-bold">
                      Repetera nytt lösenord
                    </label>
                    <PasswordInput
                      value={repeatPassword}
                      onChange={(e) => setRepeatPassword(e.target.value)}
                      className="bg-[var(--input-text)] text-[var(--text-primary)] focus:outline-none p-3"
                    />
                  </div>

                  {passwordRequirementMessage && (
                    <p className="text-xs text-gray-500 -mt-2">
                      {passwordRequirementMessage}
                    </p>
                  )}

                  {passwordStatus && (
                    <p
                      className={`text-sm font-medium ${passwordStatus.type === "success" ? "text-green-700" : "text-red-700"}`}
                    >
                      {passwordStatus.message}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isSavingPassword}
                    className="mt-8 w-full bg-[var(--button-submit)] hover:bg-[var(--button-submit-hover)] disabled:bg-gray-400 text-white font-bold py-4 px-6 rounded-lg transition-colors duration-300 text-lg shadow-md"
                  >
                    {isSavingPassword ? "Sparar..." : "Spara lösenord"}
                  </button>
                </form>
              </div>
            )}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
