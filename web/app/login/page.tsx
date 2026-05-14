"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { loginProcedure, getCurrentlySignedInUser } from "@/lib/api";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememerMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsLoading(true);

    try {
      await loginProcedure(email, password, rememberMe);

      // Cache the role locally to avoid a visible navbar flicker on navigation
      try {
        const resp = await getCurrentlySignedInUser();
        if (resp.status && resp.data) {
          if (resp.data.role) {
            try {
              window.localStorage.setItem("userRole", resp.data.role);
            } catch (_) {}
          } else {
            try {
              window.localStorage.removeItem("userRole");
            } catch (_) {}
          }
        } else {
          try {
            window.localStorage.removeItem("userRole");
          } catch (_) {}
        }
      } catch (e) {
        try {
          window.localStorage.removeItem("userRole");
        } catch (_) {}
      }

      router.push("/home");
      router.refresh();
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setIsLoading(false);
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
      {/* Logotypen uppe till höger */}
      <div className="absolute top-8 right-8 bg-white p-3 rounded shadow-lg z-20 flex items-center justify-center">
        <img
          src="/logo.png"
          alt="Börjes Logotyp"
          className="h-10 w-auto object-contain"
        />
      </div>

      {/* Inloggningsboxen */}
      <div className="relative z-10 bg-white p-10 md:p-16 rounded-sm shadow-2xl w-full max-w-md mx-4">
        <h1 className="text-4xl font-bold text-center mb-10 text-gray-800 tracking-tight">
          Logga in
        </h1>

        <form onSubmit={handleLogin} className="space-y-8">
          <div className="flex items-center border-b border-gray-400 py-2 focus-within:border-[#76a57d]">
            <span className="text-gray-500 mr-3"></span>
            <input
              type="text"
              data-testid="email-input"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="appearance-none bg-transparent border-none w-full text-gray-700 mr-3 py-1 px-2 leading-tight focus:outline-none"
              required
            />
          </div>

          <div className="flex items-center border-b border-gray-400 py-2 focus-within:border-[#76a57d]">
            <span className="text-gray-500 mr-3"></span>
            <input
              type={showPassword ? "text" : "password"}
              data-testid="password-input"
              placeholder="Lösenord"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="appearance-none bg-transparent border-none w-full text-gray-700 mr-3 py-1 px-2 leading-tight focus:outline-none"
              required
            />
            {/* Knapp för att toggla lösenordssynlighet */}
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-gray-500 hover:text-gray-800 focus:outline-none transition-colors"
              aria-label={showPassword ? "Dölj lösenord" : "Visa lösenord"}
            >
              {showPassword ? (
                // Överstruket öga (dölj)
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
              ) : (
                // Vanligt öga (visa)
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
                    d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              )}
            </button>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-600">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                data-testid="remember-me"
                checked={rememberMe}
                onChange={(e) => setRememerMe(e.target.checked)}
                className="mr-2 accent-[#76a57d]"
              />
              Kom ihåg mig
            </label>
            <Link href="/forgot-password" className="underline hover:text-black transition-colors">
              Glömt lösenord?
            </Link>
          </div>

          {errorMsg && (
            <p
              data-testid="error-message"
              className="text-red-500 text-sm text-center font-medium"
            >
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            data-testid="login-button"
            disabled={isLoading}
            className="w-full bg-[#7ec58a] hover:bg-[#6db579] text-white font-bold py-3 px-4 rounded-full shadow-md transition-all transform active:scale-95 uppercase tracking-widest text-sm"
          >
            {isLoading ? "Väntar..." : "LOGIN"}
          </button>
        </form>
      </div>
    </div>
  );
}
