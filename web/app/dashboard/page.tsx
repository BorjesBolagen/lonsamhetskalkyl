"use client";

import { useState } from "react";
import { sendMessage } from "@/lib/api";

export default function Dashboard() {
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    setIsSending(true);
    setError(null);
    setResponse(null);

    try {
      const data = await sendMessage(message);
      const replyTime = data.sentAt ? ` (${data.sentAt})` : "";
      setResponse(`Backend replied: ${data.received}${replyTime}`);
    } catch (err) {
      setError("Could not send message");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-6 py-16">
        <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
        <label className="text-sm font-medium text-zinc-700" htmlFor="message">
          Message
        </label>
        <input
          id="message"
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
          type="text"
          placeholder="Write a message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <button
          className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
          type="button"
          onClick={handleSend}
          disabled={isSending || message.trim().length === 0}
        >
          {isSending ? "Sending..." : "Send to backend"}
        </button>
        {response ? (
          <p className="text-sm text-emerald-700">{response}</p>
        ) : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
