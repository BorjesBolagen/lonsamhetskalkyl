"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememerMe] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsLoading(true);

    try {
        const res = await fetch("/api/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          }, body: JSON.stringify({email, password, rememberMe}),
        });

        const result = await res.json();

      if (!res.ok || !result.ok) {
        setErrorMsg("Inloggning misslyckades: " + (result.error ?? "Okänt fel"));
        return;
      }
        router.push("/home");
        router.refresh();

    } catch (err) {
      setErrorMsg("Kunde inte kontakta servern: " + (err as Error).message);
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
        `
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
              type="password"
              data-testid="password-input"
              placeholder="Lösenord"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="appearance-none bg-transparent border-none w-full text-gray-700 mr-3 py-1 px-2 leading-tight focus:outline-none"
              required
            />
          </div>

          <div className="flex items-center justify-between text-xs text-gray-600">
            <label className="flex items-center cursor-pointer">
              <input type="checkbox" data-testid="remember-me" checked = {rememberMe} onChange={(e) => setRememerMe(e.target.checked)} className="mr-2 accent-[#76a57d]"  />
              Kom ihåg mig
            </label>
            <a href="#" className="underline hover:text-black transition-colors">
              Glömt lösenord?
            </a>
          </div>

          {errorMsg && (
            <p data-testid="error-message" className="text-red-500 text-sm text-center font-medium">{errorMsg}</p>
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