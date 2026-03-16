"use client";
import Navigation from "../../components/Navigation";
import Footer from "../../components/Footer";
import { useState } from "react";
import { sendMessage, tokenCheck } from "@/lib/api";
import { Enums } from "@/lib/supabaseServerSchema";
import { Constants } from "@/lib/supabaseServerSchema";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import {
  pageContainer,
  contentWrapper,
  box,
  textarea,
  select,
  button,
  buttonDisabled,
  colors,
  border,
} from "@/styles/constants";

export default function Admin() {

  // Used for sending test messages to supabase
  const [adminMessage, setAdminMessage] = useState("");
  const [adminResponse, setAdminResponse] = useState("");
  const [isSendingMessage, setIsSending] = useState(false);
  
  // Used for signing up
  type UserRole = Enums<"User_specialization_types">;
  const [role, setRole] = useState<UserRole | "">("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [signupResponse, setSignupResponse] = useState("");

  // Used for token check
  const [tokenResponse, setTokenResponse] = useState("");

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminMessage.trim()) return;

    setIsSending(true);
    try {
      const data = await sendMessage(adminMessage);
      const replyTime = data.sentAt ? ` (${data.sentAt})` : "";
      setAdminResponse(`Backend replied: ${data.received}${replyTime}`);
      setAdminMessage("");
    } catch (error) {
      setAdminResponse("Fel vid ändring: " + (error as Error).message);
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

      // Check if email is already present in supabase
      const { data: existingUser, error: existingUserError } = await supabase
        .from('User')
        .select('id')
        .eq('email', signupEmail)
        .maybeSingle();

      if (existingUser) {
        setSignupResponse("Angivet e-mail är redan registrerad.");
        return;
      }

      // Make signup
      const { data, error } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
      });

      if (error) {
        setSignupResponse("Fel vid registrering: " + error.message);
      } else {
        setSignupResponse("Skapade användare " + data.user?.email + " verifieringsmail skickat.");
      }

    } catch (error) {
      setSignupResponse("Fel vid registrering: " + (error as Error).message);
    } finally {
      setIsSigningUp(false);
    }
  };

  return (
    <div style={pageContainer}>
      <Navigation currentPage="admin" />
      <div style={contentWrapper}>
        <h1>Admin</h1>
        <p>
          Här kan administratörer se alla trafikledare och användare i systemet,
          samt ladda upp och hantera stora mängder data till databasen.
        </p>
        <div style={box}>
          <h3>Användarhantering</h3>
          <p>Active trafikledare: 8</p>
          <button disabled style={buttonDisabled}>
            Se alla användare
          </button>
        </div>
        <div style={box}>
          <h3>Datahantering</h3>
          <button disabled style={{ ...buttonDisabled, marginRight: "10px" }}>
            Ladda upp data
          </button>
          <button disabled style={buttonDisabled}>
            Exportera data
          </button>
        </div>
        <div style={box}>
          <h3>Lägg till användare</h3>
          <form onSubmit={handleSignup}>
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px" }}>
                E-mail:
              </label>
              <input
                type="email"
                placeholder="e-mail"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                style={textarea}
              />
            </div>
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px" }}>
                Lösenord:
              </label>
              <input
                type="password"
                placeholder="Lösenord"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                style={textarea}
              />
            </div>
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px" }}>
                Role:
              </label>
              <select
              style={textarea}
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
            >
              <option value="">Select role</option>
              {Constants.public.Enums["User_specialization_types"].map((r) => (
                <option key={r} value={r}>
                  {r === "traffic_leader" ? "Trafikledare" : "Admin"}
                </option>
              ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={isSigningUp || signupEmail.trim().length === 0 || signupPassword.trim().length === 0 || role === ""}
              style={
                isSigningUp || signupEmail.trim().length === 0 || signupPassword.trim().length === 0 || role === ""
                  ? buttonDisabled
                  : button
              }
            >
              {isSigningUp ? "Registrerar..." : "Registrera"}
            </button>
          </form>
          {signupResponse && (
            <div style={{ marginTop: "15px" }}>
              <h4>Svar från backend:</h4>
              <pre
                style={{
                  backgroundColor: colors.lightGray,
                  padding: "10px",
                  border: border.standard,
                  overflowX: "auto",
                }}
              >
                {signupResponse}
              </pre>
            </div>
          )}
        </div>
        <div style={box}>
          <h3>Skicka meddelande till Supabase</h3>
          <form onSubmit={handleSendMessage}>
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px" }}>
                Meddelande:
              </label>
              <textarea
                value={adminMessage}
                onChange={(e) => setAdminMessage(e.target.value)}
                placeholder="Skriv här"
                style={textarea}
              />
            </div>
            <button
              type="submit"
              disabled={isSendingMessage || adminMessage.trim().length === 0}
              style={
                isSendingMessage || adminMessage.trim().length === 0
                  ? buttonDisabled
                  : button
              }
            >
              {isSendingMessage ? "Skickar..." : "Skicka"}
            </button>
          </form>
          {adminResponse && (
            <div style={{ marginTop: "15px" }}>
              <h4>Svar från databasen:</h4>
              <pre
                style={{
                  backgroundColor: colors.lightGray,
                  padding: "10px",
                  border: border.standard,
                  overflowX: "auto",
                }}
              >
                {adminResponse}
              </pre>
            </div>
          )}
        </div>
        <div style={box}>
          <h3>Token Check</h3>
          <form onSubmit={async (e) => {
            e.preventDefault();
            try {
              const response = await tokenCheck();
              setTokenResponse(response.message);
              console.log("Token check response:", response);
            } catch (error) {
              console.error("Error checking token:", error);
            }
          }}>
            <button
              type="submit"
              style={button}
            >
              Check Token
            </button>
          </form>
          {tokenResponse && (
            <div style={{ marginTop: "15px" }}>
              <h4>Token Check Response:</h4>
              <pre
                style={{
                  backgroundColor: colors.lightGray,
                  padding: "10px",
                  border: border.standard,
                  overflowX: "auto",
                }}
              >
                {JSON.stringify(tokenResponse, null, 2)}
              </pre>
            </div>

          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
