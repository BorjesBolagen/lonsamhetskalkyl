/**
 * GET /api/cron/manual-daily-forecast-stream
 *
 * Streamar loggutskrifter från en manuell dagsprognos. Endast admin.
 *
 * Query params:
 *   - date=YYYY-MM-DD
 *   - offset, limit (valfria heltal): kör bara en del av ekipagen, så att en
 *     dag kan delas upp i flera förfrågor och inte når Vercels tidsgräns.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authHelpers";
import {
  getStockholmDateDaysBack,
  runDailyEquipageForecast,
} from "@/lib/forecastEngine";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DAYS_BACK = 7;

// En dag per förfrågan; intervall körs dag för dag från Analys-fliken.
export const maxDuration = 1800;
export const dynamic = "force-dynamic";

function createSseStream(
  forecastDate: string,
  options: { offset?: number; limit?: number },
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
        );
      };

      const logger = (message: string, color: string = "green") => {
        send({ type: "log", message, color });
      };

      try {
        logger(`Startar prognos för datum ${forecastDate}`);
        const summary = await runDailyEquipageForecast(
          forecastDate,
          logger,
          options,
        );
        send({ type: "done", summary });
      } catch (error) {
        send({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Okänt fel vid prognoskörning.",
        });
      } finally {
        controller.close();
      }
    },
  });
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");

  if (dateParam && !DATE_REGEX.test(dateParam)) {
    return NextResponse.json(
      {
        status: false,
        message: "Ogiltigt datum. Förväntat format YYYY-MM-DD",
      },
      { status: 400 },
    );
  }

  const forecastDate = dateParam ?? getStockholmDateDaysBack(DAYS_BACK);
  const toCount = (value: string | null) => {
    const parsed = Number(value);
    return value !== null && Number.isInteger(parsed) && parsed >= 0
      ? parsed
      : undefined;
  };
  const stream = createSseStream(forecastDate, {
    offset: toCount(url.searchParams.get("offset")),
    limit: toCount(url.searchParams.get("limit")) || undefined,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
