"use client";
import Navigation from "../../components/Navigation";
import Footer from "../../components/Footer";
import { useState } from "react";
import { sendMessage, checkUserExists } from "@/lib/api";
import { Enums, Constants } from "@/lib/supabaseServerSchema";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

// 1. Importera dina egna stil-konstanter för det yttre skalet
import { pageContainer, contentWrapper } from "@/styles/constants";

// Mock-data för att visualisera layouten tills vi kopplar riktig data
const mockTrafficLeaders = [
  { id: 1, name: "Kalle Karlsson", email: "kalle@smalands.se", district: "Växjö", kpi: "187 kr/flm", status: "🟢 Bra" },
  { id: 2, name: "Anna Andersson", email: "anna@smalands.se", district: "Lkpg", kpi: "145 kr/flm", status: "🟡 Varning" },
  { id: 3, name: "Sven Svensson", email: "sven@smalands.se", district: "Jönkp", kpi: "192 kr/flm", status: "🟢 Bra" },
];

export default function Admin() {
  // --- STATE FÖR POPUPS (MODALER) ---
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null); // För användardetaljer

  // --- STATE FÖR BEFINTLIG LOGIK ---
  const [adminMessage, setAdminMessage] = useState("");
  const [adminResponse, setAdminResponse] = useState("");
  const [isSendingMessage, setIsSending] = useState(false);
  
  type UserRole = Enums<"User_specialization_types">;
  const [role, setRole] = useState<UserRole | "">("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [signupResponse, setSignupResponse] = useState("");

  // --- FUNKTIONER ---
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
      const userExistsResponse = await checkUserExists(signupEmail);
      if (userExistsResponse.status) {
        setSignupResponse("E-mail är redan registrerad.");
        return;
      }
      const { data, error } = await supabase.auth.signUp({ email: signupEmail, password: signupPassword });
      if (error) throw error;
      
      if (data.user) {
        await supabase.from('User').update({ role }).eq('id', data.user.id);
        setSignupResponse(`Skapade användare ${data.user.email}.`);
      }
    } catch (error) {
      setSignupResponse("Fel vid registrering: " + (error as Error).message);
    } finally {
      setIsSigningUp(false);
    }
  };

  return (
    // 2. Använd din egen pageContainer för att få exakt samma bakgrund/höjd som övriga sidor
    <div style={pageContainer}>
      <Navigation currentPage="admin" />
      
      {/* 3. Använd din egen contentWrapper för att få exakt samma marginaler */}
      <div style={contentWrapper}>
        
        {/* En inre Tailwind-container för att hantera specifik layout för just Admin-sidan */}
        <div className="space-y-6 text-gray-800 font-sans w-full">
          
          {/* SIDHUVUD & ACTION-KNAPPAR */}
          <div className="flex justify-between items-center bg-white p-4 rounded shadow-sm">
            <h1 className="text-2xl font-bold text-[#446E30]">Admin & Strategisk Analys</h1>
            <div className="flex space-x-3">
              <button className="px-4 py-2 border-2 border-[#446E30] text-[#446E30] hover:bg-[#e8f1e9] font-semibold rounded transition-colors">
                Ladda upp CSV (Prognos)
              </button>
              <button 
                onClick={() => setIsAddUserOpen(true)}
                className="px-4 py-2 bg-[#7ec58a] hover:bg-[#6db579] text-white font-semibold rounded shadow transition-colors"
              >
                + Lägg till Användare
              </button>
              <button 
                onClick={() => setIsMessageModalOpen(true)}
                className="px-4 py-2 bg-[#446E30] hover:bg-[#365926] text-white font-semibold rounded shadow transition-colors"
              >
                ✉ Skicka Meddelande
              </button>
            </div>
          </div>

          {/* DASHBOARD: KPI KORT */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded shadow-sm border-t-4 border-[#7ec58a]">
              <p className="text-sm text-gray-500">Fyllnadsgrad Totalt</p>
              <p className="text-2xl font-bold">88%</p>
            </div>
            <div className="bg-white p-4 rounded shadow-sm border-t-4 border-[#446E30]">
              <p className="text-sm text-gray-500">Snitt Intäkt / FLM</p>
              <p className="text-2xl font-bold">184 kr</p>
            </div>
            <div className="bg-white p-4 rounded shadow-sm border-t-4 border-gray-400">
              <p className="text-sm text-gray-500">Aktiva Bilar</p>
              <p className="text-2xl font-bold">32 st</p>
            </div>
            <div className="bg-white p-4 rounded shadow-sm border-t-4 border-gray-400">
              <p className="text-sm text-gray-500">Körningar idag</p>
              <p className="text-2xl font-bold">142</p>
            </div>
          </div>

          {/* GRAFER (Placeholders) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded shadow-sm">
              <h3 className="font-bold mb-4">Fyllnadsgrad per Distrikt</h3>
              <div className="h-48 bg-gray-100 border border-gray-200 flex items-end justify-around p-4">
                <div className="w-12 bg-[#7ec58a] h-[80%] rounded-t-sm" title="Växjö"></div>
                <div className="w-12 bg-[#446E30] h-[60%] rounded-t-sm" title="Lkpg"></div>
                <div className="w-12 bg-[#7ec58a] h-[90%] rounded-t-sm" title="Jönkp"></div>
              </div>
            </div>
            <div className="bg-white p-6 rounded shadow-sm">
              <h3 className="font-bold mb-4">Trend: Intäkt per FLM</h3>
              <div className="h-48 bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400">
                [ Här lägger vi in Recharts-linjegraf senare ]
              </div>
            </div>
          </div>

          {/* ANVÄNDARLISTA */}
          <div className="bg-white p-6 rounded shadow-sm">
            <h3 className="font-bold text-lg mb-4">Trafikledare & Prestanda</h3>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="p-3">Namn / Email</th>
                  <th className="p-3">Distrikt</th>
                  <th className="p-3">Snitt Intäkt/FLM</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {mockTrafficLeaders.map((user) => (
                  <tr 
                    key={user.id} 
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedUser(user)}
                  >
                    <td className="p-3 text-[#446E30] font-medium">{user.name} <br/><span className="text-xs text-gray-500">{user.email}</span></td>
                    <td className="p-3">{user.district}</td>
                    <td className="p-3">{user.kpi}</td>
                    <td className="p-3">{user.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL: LÄGG TILL ANVÄNDARE */}
      {isAddUserOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-full max-w-md relative text-gray-800">
            <button onClick={() => setIsAddUserOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-black">✖</button>
            <h3 className="font-bold text-xl mb-4">Skapa Ny Användare</h3>
            <form onSubmit={handleSignup} className="space-y-4">
              <input type="email" placeholder="E-mail" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} className="w-full p-2 border rounded" />
              <input type="password" placeholder="Lösenord" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} className="w-full p-2 border rounded" />
              <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="w-full p-2 border rounded">
                <option value="">Välj roll</option>
                {Constants.public.Enums["User_specialization_types"].map((r) => (
                  <option key={r} value={r}>{r === "traffic_leader" ? "Trafikledare" : "Admin"}</option>
                ))}
              </select>
              <button type="submit" disabled={isSigningUp} className="w-full bg-[#7ec58a] text-white p-2 rounded font-bold hover:bg-[#6db579] disabled:opacity-50">
                {isSigningUp ? "Registrerar..." : "Registrera"}
              </button>
            </form>
            {signupResponse && <p className="mt-4 p-2 bg-gray-100 text-sm rounded">{signupResponse}</p>}
          </div>
        </div>
      )}

      {/* MODAL: SKICKA MEDDELANDE */}
      {isMessageModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-full max-w-md relative text-gray-800">
            <button onClick={() => setIsMessageModalOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-black">✖</button>
            <h3 className="font-bold text-xl mb-4">Skicka info till alla</h3>
            <form onSubmit={handleSendMessage} className="space-y-4">
              <textarea value={adminMessage} onChange={(e) => setAdminMessage(e.target.value)} placeholder="Skriv ditt meddelande här..." className="w-full p-2 border rounded h-32"></textarea>
              <button type="submit" disabled={isSendingMessage} className="w-full bg-[#446E30] text-white p-2 rounded font-bold hover:bg-[#365926] disabled:opacity-50">
                {isSendingMessage ? "Skickar..." : "Skicka"}
              </button>
            </form>
            {adminResponse && <p className="mt-4 p-2 bg-gray-100 text-sm rounded">{adminResponse}</p>}
          </div>
        </div>
      )}

      {/* MODAL: ANVÄNDARDETALJER */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-full max-w-sm relative border-t-8 border-[#446E30] text-gray-800">
            <button onClick={() => setSelectedUser(null)} className="absolute top-4 right-4 text-gray-500 hover:text-black">✖</button>
            <h3 className="font-bold text-xl mb-2">{selectedUser.name}</h3>
            <p className="text-gray-600 mb-4">{selectedUser.email}</p>
            <div className="space-y-2">
              <p><strong>Distrikt:</strong> {selectedUser.district}</p>
              <p><strong>Prestanda:</strong> {selectedUser.kpi}</p>
              <p><strong>Sparade filter:</strong> L44, L45</p>
            </div>
            <button onClick={() => setSelectedUser(null)} className="mt-6 w-full border border-gray-300 p-2 rounded hover:bg-gray-50 transition-colors">Stäng</button>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}