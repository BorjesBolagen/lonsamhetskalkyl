import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

type MessagePayload = {
  message?: string;
  sentAt?: string;
};

export async function POST(request: Request) {
  let payload: MessagePayload = {};

  try {
    payload = (await request.json()) as MessagePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { message, sentAt } = payload;

  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const timeValue = typeof sentAt === "string" ? sentAt : "";

  try {
    const supabase = await getSupabaseServerClient();

    const { data, error } = await supabase
      .from("messages")
      .insert([{ message, sent_at: timeValue }]);

    if (error) {
      return NextResponse.json(
        { error: "Failed to save message" },
        { status: 500 }
      );
    }

    return NextResponse.json({ received: message, sentAt: timeValue });
  } catch {
    return NextResponse.json({ error: "Failed to save message" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok" });
}
