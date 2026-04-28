import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

/**
 * Delar upp taxPointRelation från formatet sender-receiver.
 */
function parseTaxPointRelation(taxPointRelation: string | null) {
  if (!taxPointRelation) {
    return null;
  }

  const parts = taxPointRelation
    .split("-")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length !== 2) {
    return null;
  }

  const sender = Number(parts[0]);
  const receiver = Number(parts[1]);

  if (!Number.isFinite(sender) || !Number.isFinite(receiver)) {
    return null;
  }

  return { sender, receiver };
}

/**
 * GET /api/simulator/distance-map?taxPointRelation=sender-receiver
 *
 * Hämtar km från distance_map genom sender och receiver.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const taxPointRelation = searchParams.get("taxPointRelation");

  const parsed = parseTaxPointRelation(taxPointRelation);

  if (!parsed) {
    return NextResponse.json(
      {
        status: false,
        message:
          `Ogiltig taxPointRelation. Förväntat format: sender-receiver. ` +
          `Mottaget värde: ${JSON.stringify(taxPointRelation)}`,
      },
      { status: 400 },
    );
  }

  const { sender, receiver } = parsed;

  try {
    const supabase = await getSupabaseServerClient();

    // Försök exakt riktning först.
    const forwardResult = await supabase
      .from("distance_map")
      .select("sender, receiver, distance")
      .eq("sender", sender)
      .eq("receiver", receiver)
      .maybeSingle();

    if (forwardResult.error) {
      return NextResponse.json(
        {
          status: false,
          message: `Kunde inte läsa distance_map: ${forwardResult.error.message}`,
        },
        { status: 500 },
      );
    }

    if (forwardResult.data) {
      return NextResponse.json({
        status: true,
        message: "Distance hittad",
        data: {
          sender: forwardResult.data.sender,
          receiver: forwardResult.data.receiver,
          distanceKm: Number(forwardResult.data.distance),
        },
      });
    }

    // Fallback: försök omvänd riktning.
    const reverseResult = await supabase
      .from("distance_map")
      .select("sender, receiver, distance")
      .eq("sender", receiver)
      .eq("receiver", sender)
      .maybeSingle();

    if (reverseResult.error) {
      return NextResponse.json(
        {
          status: false,
          message: `Kunde inte läsa distance_map: ${reverseResult.error.message}`,
        },
        { status: 500 },
      );
    }

    if (reverseResult.data) {
      return NextResponse.json({
        status: true,
        message: "Distance hittad",
        data: {
          sender: reverseResult.data.sender,
          receiver: reverseResult.data.receiver,
          distanceKm: Number(reverseResult.data.distance),
        },
      });
    }

    return NextResponse.json({
      status: false,
      message: "Ingen distance hittades för taxPointRelation.",
      data: {
        sender,
        receiver,
        distanceKm: null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: false,
        message: error instanceof Error ? error.message : "Internt serverfel",
      },
      { status: 500 },
    );
  }
}