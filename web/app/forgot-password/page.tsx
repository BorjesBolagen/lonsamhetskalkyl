"use client";

import Link from "next/link";
import { useState } from "react";
import { forgotPassword } from "@/lib/api";
import { validateEmail } from "@/lib/validation";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (!validateEmail(email)) {
      setMessage("Skriv in en giltig e-postadress.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await forgotPassword(email);
      setMessage(response.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Något gick fel.");
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
      <div className="absolute top-8 right-8 bg-white p-3 rounded shadow-lg z-20 flex items-center justify-center">
        <img
          src="/logo.png"
          alt="Börjes Logotyp"
          className="h-10 w-auto object-contain"
        />
      </div>

      <div className="relative z-10 bg-white p-10 md:p-14 rounded-sm shadow-2xl w-full max-w-md mx-4">
        <h1 className="text-4xl font-bold text-center mb-6 text-gray-800 tracking-tight">
          Återställ lösenord
        </h1>
        <p className="text-center text-sm text-gray-600 mb-8 leading-relaxed">
          Skriv in din e-postadress så skickar vi en länk för att återställa
          lösenordet.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center border-b border-gray-400 py-2 focus-within:border-[#76a57d]">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="appearance-none bg-transparent border-none w-full text-gray-700 mr-3 py-1 px-2 leading-tight focus:outline-none"
              required
            />
          </div>

          {message && (
            <p className="text-sm text-center font-medium text-gray-700">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#7ec58a] hover:bg-[#6db579] disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-full shadow-md transition-all transform active:scale-95 uppercase tracking-widest text-sm"
          >
            {isLoading ? "Skickar..." : "Skicka återställningslänk"}
          </button>

          <div className="text-center">
            <Link
              href="/login"
              className="text-sm underline hover:text-black transition-colors"
            >
              Tillbaka till inloggning
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
