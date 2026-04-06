"use client";
import Navigation from "../../components/Navigation";
import Footer from "../../components/Footer";
import { useState } from "react";

export default function Settings() {
  const [activeTab, setActiveTab] = useState<"konto" | "losenord">("konto");

  // States för lösenordsvisning
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);

  // States för formulären
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  
  // States för områden
  const [districts, setDistricts] = useState({
    linkoping: true,
    vaxjo: false,
    sundsvall: true,
    jonkoping: false,
  });

  // Ikoner för ögat
  const EyeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.644C3.542 4.639 8.05 1 12 1c3.95 0 8.454 3.469 9.964 10.678.07.322.07.653 0 0.976 C20.457 18.332 15.947 22 12 22c-3.95 0-8.454-3.469-9.964-10.678z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );

  const EyeSlashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#EEEEEE]">
      
      {/* Wrapper för navigationsbaren så den ligger överst */}
      <div className="relative z-[60]">
        <Navigation currentPage="settings" />
      </div>
      
      <main className="flex-grow flex flex-col p-6 items-center">
        
        {/* Yttre container, max-w-lg gör lådan lagom snäv (inget onödigt vitt utrymme) */}
        <div className="font-sans text-gray-800 w-full max-w-lg">
          <h1 className="text-4xl font-serif font-bold text-gray-800 mb-8 text-center">Mitt Konto</h1>

          {/* TOPPMENY (Flikar) */}
          <div className="flex justify-center gap-4 mb-2">
            
            {/* KONTO-FLIKEN */}
            <button
              onClick={() => setActiveTab("konto")}
              className={`flex items-center justify-center space-x-2 px-6 py-3 rounded-t-lg text-lg font-bold transition-colors min-w-[160px] border-b-4 ${
                activeTab === "konto" ? "bg-white text-black border-[#446E30]" : "bg-transparent text-gray-600 border-transparent hover:bg-white/50"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>Konto</span>
            </button>

            {/* LÖSENORD-FLIKEN */}
            <button
              onClick={() => setActiveTab("losenord")}
              className={`flex items-center justify-center space-x-2 px-6 py-3 rounded-t-lg text-lg font-bold transition-colors min-w-[160px] border-b-4 ${
                activeTab === "losenord" ? "bg-white text-black border-[#446E30]" : "bg-transparent text-gray-600 border-transparent hover:bg-white/50"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              <span>Lösenord</span>
            </button>
            
          </div>

          {/* HUVUDINNEHÅLL */}
          <section className="bg-white rounded-xl shadow-md p-8 sm:p-10 min-h-[450px]">
            
            {/* INNEHÅLL: KONTO (Kombinerad info och inställningar) */}
            {activeTab === "konto" && (
              <div className="space-y-10 w-full mx-auto">
                
                {/* DEL 1: Kontoinformation (Read-only) */}
                <div>
                  <h3 className="font-bold text-xl mb-4 border-b-2 border-green-500 pb-2">Din Profil</h3>
                  <div className="bg-gray-50 p-5 rounded-lg border border-gray-100 space-y-3">
                    <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                      <span className="font-bold text-gray-500">Användarnamn:</span>
                      <span className="text-gray-800 font-medium">trafikledare_001</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                      <span className="font-bold text-gray-500">E-post:</span>
                      <span className="text-gray-800 font-medium">trafikledare@linkoping.se</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-gray-500">Roll:</span>
                      <span className="bg-[#e5efe6] text-[#446E30] px-3 py-1 rounded-full text-sm font-bold">Admin</span>
                    </div>
                  </div>
                </div>

                {/* DEL 2: Områden (Interaktiv) */}
                <div>
                  <h3 className="font-bold text-xl mb-4 border-b-2 border-green-500 pb-2">Filtrera dina områden</h3>
                  <div className="flex flex-col space-y-4">
                    {Object.keys(districts).map((dist) => {
                      const distKey = dist as keyof typeof districts;
                      const labels: Record<string, string> = { linkoping: "Linköping", vaxjo: "Växjö", sundsvall: "Sundsvall", jonkoping: "Jönköping" };
                      
                      return (
                        <label key={dist} className="flex items-center justify-between cursor-pointer border-b border-gray-200 pb-2 w-full hover:bg-gray-50 transition-colors px-2 rounded">
                          <span className="font-bold text-lg text-gray-700">{labels[distKey]}</span>
                          <div className="relative flex items-center">
                            <input
                              type="checkbox"
                              checked={districts[distKey]}
                              onChange={() => setDistricts({ ...districts, [distKey]: !districts[distKey] })}
                              className="w-6 h-6 appearance-none border-2 border-gray-400 bg-white checked:bg-white rounded-sm cursor-pointer"
                            />
                            {districts[distKey] && (
                              <span className="absolute inset-0 flex items-center justify-center text-black pointer-events-none pb-1 font-bold text-lg">
                                x
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* DEL 3: Tema (Interaktiv) */}
                <div>
                  <h3 className="font-bold text-xl mb-4 border-b-2 border-green-500 pb-2">Tema</h3>
                  <div className="flex space-x-4">
                    <button className="flex-1 bg-[#7ec58a] text-black font-bold py-3 px-6 rounded-lg shadow-sm border border-[#6ab076] transition-transform active:scale-95">
                      Light
                    </button>
                    <button className="flex-1 bg-gray-800 text-white font-bold py-3 px-6 rounded-lg shadow-sm opacity-80 hover:opacity-100 transition-all active:scale-95">
                      Dark
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* INNEHÅLL: LÖSENORD */}
            {activeTab === "losenord" && (
              <div className="w-full mx-auto">
                <h3 className="font-bold text-xl mb-6 text-center border-b-2 border-green-500 pb-2">Byt lösenord</h3>
                <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                  
                  <div className="flex flex-col bg-gray-50 p-4 rounded-lg shadow-sm">
                    <label className="mb-2 text-sm font-bold text-gray-700">Nuvarande lösenord</label>
                    <div className="relative">
                      <input 
                        type={showCurrentPassword ? "text" : "password"} 
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full p-3 pr-12 border-2 border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#7ec58a]" 
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-3.5 text-gray-500 hover:text-black transition-colors"
                      >
                        {showCurrentPassword ? <EyeSlashIcon /> : <EyeIcon />}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col bg-gray-50 p-4 rounded-lg shadow-sm">
                    <label className="mb-2 text-sm font-bold text-gray-700">Nytt lösenord</label>
                    <div className="relative">
                      <input 
                        type={showNewPassword ? "text" : "password"} 
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full p-3 pr-12 border-2 border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#7ec58a]" 
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-3.5 text-gray-500 hover:text-black transition-colors"
                      >
                        {showNewPassword ? <EyeSlashIcon /> : <EyeIcon />}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col bg-gray-50 p-4 rounded-lg shadow-sm">
                    <label className="mb-2 text-sm font-bold text-gray-700">Repetera nytt lösenord</label>
                    <div className="relative">
                      <input 
                        type={showRepeatPassword ? "text" : "password"} 
                        value={repeatPassword}
                        onChange={(e) => setRepeatPassword(e.target.value)}
                        className="w-full p-3 pr-12 border-2 border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#7ec58a]" 
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowRepeatPassword(!showRepeatPassword)}
                        className="absolute right-3 top-3.5 text-gray-500 hover:text-black transition-colors"
                      >
                        {showRepeatPassword ? <EyeSlashIcon /> : <EyeIcon />}
                      </button>
                    </div>
                  </div>

                  <button className="mt-8 w-full bg-[#75C07A] hover:bg-green-800 text-white font-bold py-4 px-6 rounded-lg transition-colors duration-300 text-lg shadow-md">
                    Spara lösenord
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