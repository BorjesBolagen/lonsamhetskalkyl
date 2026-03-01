"use client";
import Navigation from "../../components/Navigation";
import Footer from "../../components/Footer";
import { useState } from "react";
import { sendMessage } from "@/lib/api";
import {
  pageContainer,
  contentWrapper,
  box,
  textarea,
  button,
  buttonDisabled,
  colors,
  border,
} from "@/styles/constants";

export default function Admin() {
  const [adminMessage, setAdminMessage] = useState("");
  const [adminResponse, setAdminResponse] = useState("");
  const [isSending, setIsSending] = useState(false);

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
              disabled={isSending || adminMessage.trim().length === 0}
              style={
                isSending || adminMessage.trim().length === 0
                  ? buttonDisabled
                  : button
              }
            >
              {isSending ? "Skickar..." : "Skicka"}
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
      </div>
      <Footer />
    </div>
  );
}
