"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { validatePassword } from "@/lib/validation";

function EyeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="w-5 h-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 010-.644C3.542 4.639 8.05 1 12 1c3.95 0 8.454 3.469 9.964 10.678.07.322.07.653 0 .976C20.457 18.332 15.947 22 12 22c-3.95 0-8.454-3.469-9.964-10.678z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function EyeSlashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="w-5 h-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
      />
    </svg>
  );
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);
  const [passwordRequirements, setPasswordRequirements] = useState({
    hasMinLength: false,
    hasDigit: false,
  });
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Generate dynamic requirement message showing only unfulfilled criteria
  const passwordRequirementMessage =
    !passwordRequirements.hasMinLength && !passwordRequirements.hasDigit
      ? "Behöver minst 7 tecken och minst 1 siffra."
      : !passwordRequirements.hasMinLength
        ? "Behöver minst 7 tecken."
        : !passwordRequirements.hasDigit
          ? "Behöver minst 1 siffra."
          : "";

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let isMounted = true;

    const initialize = async () => {
      // Supabase can send recovery params either as query (?code=...) or hash
      // (#access_token=...&refresh_token=...&type=recovery).
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (!isMounted) return;

        if (!error && data.session) {
          // Clean URL so tokens are not kept in browser history.
          window.history.replaceState(null, "", window.location.pathname);
          setHasRecoverySession(true);
          setIsLoadingSession(false);
          return;
        }
      }

      // Extract recovery code from email link
      const code = new URLSearchParams(window.location.search).get("code");

      // Exchange recovery code for authenticated session
      if (code) {
        const { data, error } =
          await supabase.auth.exchangeCodeForSession(code);

        if (!isMounted) return;

        if (!error && data.session) {
          setHasRecoverySession(true);
          setIsLoadingSession(false);
          return;
        }
      }

      // Fallback: check for existing session
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      setHasRecoverySession(Boolean(data.session));
      setIsLoadingSession(false);
    };

    // Listen for auth state changes (PASSWORD_RECOVERY event from Supabase)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
          setHasRecoverySession(Boolean(session));
          setIsLoadingSession(false);
        }
      },
    );

    initialize().catch(() => {
      if (!isMounted) return;
      setHasRecoverySession(false);
      setIsLoadingSession(false);
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    // Validate recovery session exists
    if (!hasRecoverySession) {
      setMessage(
        "Återställningslänken verkar inte längre vara giltig. Begär en ny länk och försök igen.",
      );
      return;
    }

    // Validate passwords match
    if (newPassword !== repeatPassword) {
      setMessage("De nya lösenorden matchar inte.");
      return;
    }

    // Validate password requirements
    if (!validatePassword(newPassword)) {
      setMessage(
        "Lösenordet måste vara minst 7 tecken långt och innehålla minst 1 siffra.",
      );
      return;
    }

    setIsSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();
      // Update user password and automatically sign out
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw error;
      }

      await supabase.auth.signOut();
      setMessage("Lösenordet har uppdaterats. Du skickas nu till inloggning.");
      setTimeout(() => {
        router.replace("/login");
        router.refresh();
      }, 1000);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Kunde inte uppdatera lösenordet.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="relative min-h-screen w-full flex items-center justify-center overflow-hidden"
      style={{
        backgroundImage: `
				  linear-gradient(135deg, #7FB283 15%, transparent 15.2%),
				  linear-gradient(300deg, #426d46 25%, transparent 25.2%),
				  linear-gradient(15deg, #1D3A21 15%, transparent 15.2%),
				  linear-gradient(to bottom, #AEE3B2 0%, #446E30 100%)
				`,
      }}
    >
      <div className="absolute top-8 right-8 bg-white p-3 rounded shadow-lg z-20 flex items-center justify-center">
        <img
          src="/logo.png"
          alt="Börjes Logotyp"
          className="h-10 w-auto object-contain"
        />
      </div>

      <div className="relative z-10 bg-white p-10 md:p-14 rounded-sm shadow-2xl w-full max-w-md mx-4">
        <h1 className="text-4xl font-bold text-center mb-6 text-gray-800 tracking-tight">
          Nytt lösenord
        </h1>
        <p className="text-center text-sm text-gray-600 mb-8 leading-relaxed">
          Skriv in ditt nya lösenord två gånger för att uppdatera.
        </p>

        {isLoadingSession ? (
          <p className="text-center text-sm text-gray-600">
            Kontrollerar återställningslänk...
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center border-b border-gray-400 py-2 focus-within:border-[#76a57d] relative">
              <input
                type={showNewPassword ? "text" : "password"}
                placeholder="Nytt lösenord"
                value={newPassword}
                onChange={(e) => {
                  const value = e.target.value;
                  setNewPassword(value);
                  // Update password requirements dynamically as user types
                  setPasswordRequirements({
                    hasMinLength: value.length >= 7,
                    hasDigit: /\d/.test(value),
                  });
                }}
                className="appearance-none bg-transparent border-none w-full text-gray-700 mr-3 py-1 px-2 pr-10 leading-tight focus:outline-none"
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="text-gray-500 hover:text-gray-800 focus:outline-none transition-colors p-1"
                aria-label={showNewPassword ? "Dölj lösenord" : "Visa lösenord"}
              >
                {showNewPassword ? <EyeIcon /> : <EyeSlashIcon />}
              </button>
            </div>

            <div className="flex items-center border-b border-gray-400 py-2 focus-within:border-[#76a57d] relative">
              <input
                type={showRepeatPassword ? "text" : "password"}
                placeholder="Upprepa nytt lösenord"
                value={repeatPassword}
                onChange={(e) => setRepeatPassword(e.target.value)}
                className="appearance-none bg-transparent border-none w-full text-gray-700 mr-3 py-1 px-2 pr-10 leading-tight focus:outline-none"
                required
              />
              <button
                type="button"
                onClick={() => setShowRepeatPassword(!showRepeatPassword)}
                className="text-gray-500 hover:text-gray-800 focus:outline-none transition-colors p-1"
                aria-label={
                  showRepeatPassword ? "Dölj lösenord" : "Visa lösenord"
                }
              >
                {showRepeatPassword ? <EyeIcon /> : <EyeSlashIcon />}
              </button>
            </div>

            {passwordRequirementMessage && (
              <p className="text-xs text-gray-500 -mt-4">
                {passwordRequirementMessage}
              </p>
            )}

            {message && (
              <p className="text-sm text-center font-medium text-gray-700">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-[#7ec58a] hover:bg-[#6db579] disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-full shadow-md transition-all transform active:scale-95 uppercase tracking-widest text-sm"
            >
              {isSaving ? "Sparar..." : "Spara nytt lösenord"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
