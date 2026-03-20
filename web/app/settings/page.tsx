"use client";
import Navigation from "../../components/Navigation";
import Footer from "../../components/Footer";
import { useState } from "react";

// Importera dina egna konstanter för layouten
import { pageContainer, contentWrapper } from "@/styles/constants";

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
  const [districts, setDistricts] = useState({
    lkpg: false,
    vaxjo: true,
    sundsvall: false,
    jonkp: true,
  });

  // Enkel, svartvit SVG-ikon för ögat (Hämtad från Heroicons)
  const EyeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.644C3.542 4.639 8.05 1 12 1c3.95 0 8.454 3.469 9.964 10.678.07.322.07.653 0 0.976 C20.457 18.332 15.947 22 12 22c-3.95 0-8.454-3.469-9.964-10.678z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );

  // Ikon för överstruket öga (när lösenordet visas)
  const EyeSlashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  );

  return (
    <div style={pageContainer}>
      <Navigation currentPage="settings" />
      
      <div style={contentWrapper}>
        
        {/* Inställningssidans specifika layout, centrerad */}
        <div className="font-sans text-gray-800 w-full max-w-3xl mx-auto">
          <h1 className="text-4xl font-serif font-bold text-black mb-8 text-center">Inställningar</h1>

          {/* TOPPMENY (Flikar) - Horisontell och centrerad */}
          <div className="flex justify-center gap-4 mb-6">
            <button
              onClick={() => setActiveTab("konto")}
              className={`flex items-center justify-center space-x-2 px-8 py-3 rounded-t-lg text-lg font-bold transition-colors w-40 border-b-4 ${
                activeTab === "konto" ? "bg-[#e5efe6] text-black border-[#446E30]" : "bg-transparent text-gray-600 border-transparent hover:bg-[#e5efe6]/50"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>Konto</span>
            </button>

            <button
              onClick={() => setActiveTab("losenord")}
              className={`flex items-center justify-center space-x-2 px-8 py-3 rounded-t-lg text-lg font-bold transition-colors w-40 border-b-4 ${
                activeTab === "losenord" ? "bg-[#e5efe6] text-black border-[#446E30]" : "bg-transparent text-gray-600 border-transparent hover:bg-[#e5efe6]/50"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Lösenord</span>
            </button>
          </div>

          {/* HUVUDINNEHÅLL - Centrerad ruta under flikarna */}
          <section className="bg-[#e5efe6] rounded shadow-md p-10 min-h-[450px]">
            
            {/* INNEHÅLL: KONTO */}
            {activeTab === "konto" && (
              <div className="space-y-8 max-w-md mx-auto">
                <div>
                  <h3 className="font-bold text-xl mb-6">Tema</h3>
                  <div className="flex space-x-4">
                    <button className="flex-1 bg-[#7ec58a] text-black font-bold py-2 px-6 rounded shadow-sm border border-[#6ab076]">
                      Light
                    </button>
                    <button className="flex-1 bg-[#446E30] text-white font-bold py-2 px-6 rounded shadow-sm opacity-80 hover:opacity-100 transition-opacity">
                      Dark
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-xl mb-6">Dina områden:</h3>
                  <div className="flex flex-col space-y-4">
                    {Object.keys(districts).map((dist) => {
                      const distKey = dist as keyof typeof districts;
                      const labels: Record<string, string> = { lkpg: "Lkpg", vaxjo: "Växjö", sundsvall: "Sundsvall", jonkp: "Jönk" };
                      
                      return (
                        <label key={dist} className="flex items-center justify-between cursor-pointer border-b border-[#c4dbc6] pb-2 w-full">
                          <span className="font-bold text-lg">{labels[distKey]}</span>
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
              </div>
            )}

            {/* INNEHÅLL: LÖSENORD */}
            {activeTab === "losenord" && (
              <div className="max-w-sm mx-auto">
                <h3 className="font-bold text-xl mb-6 text-center">Byt lösenord</h3>
                <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                  
                  <div>
                    <label className="block font-bold mb-2">Nuvarande lösenord:</label>
                    <div className="relative">
                      <input 
                        type={showCurrentPassword ? "text" : "password"} 
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full p-3 pr-12 border border-gray-300 rounded shadow-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#7ec58a]" 
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

                  <div>
                    <label className="block font-bold mb-2">Nytt lösenord</label>
                    <div className="relative">
                      <input 
                        type={showNewPassword ? "text" : "password"} 
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full p-3 pr-12 border border-gray-300 rounded shadow-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#7ec58a]" 
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

                  <div>
                    <label className="block font-bold mb-2">Repetera nytt lösenord</label>
                    <div className="relative">
                      <input 
                        type={showRepeatPassword ? "text" : "password"} 
                        value={repeatPassword}
                        onChange={(e) => setRepeatPassword(e.target.value)}
                        className="w-full p-3 pr-12 border border-gray-300 rounded shadow-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#7ec58a]" 
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

                  <button className="mt-8 w-full bg-[#7ec58a] hover:bg-[#6db579] text-white font-bold py-3 px-6 rounded shadow transition-colors text-lg">
                    Spara lösenord
                  </button>

                </form>
              </div>
            )}
            
          </section>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}