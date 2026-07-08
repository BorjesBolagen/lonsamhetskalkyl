/**
 * GET /api/cron/manual-daily-forecast-stream
 *
 * Streamar loggutskrifter från en manuell dagsprognos. Endast admin.
 *
 * Query params:
 *   - date=YYYY-MM-DD
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authHelpers";
import {
  getStockholmDateDaysBack,
  runDailyEquipageForecast,
} from "@/lib/forecastEngine";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DAYS_BACK = 7;

function createSseStream(
  forecastDate: string,
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
        const summary = await runDailyEquipageForecast(forecastDate, logger);
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
  const stream = createSseStream(forecastDate);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
