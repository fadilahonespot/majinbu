import { NextRequest, NextResponse } from "next/server";
import { getVideoStatusByRequestId, startVideoGeneration } from "@/features/food/food.service";
import { logger } from "@/lib/logger";
import { getClientIp, rateLimit } from "@/lib/rateLimit";

export async function GET(request: NextRequest) {
  const requestId = request.nextUrl.searchParams.get("requestId");
  if (!requestId) {
    return NextResponse.json({ error: "requestId is required" }, { status: 400 });
  }

  const status = await getVideoStatusByRequestId(requestId);
  return NextResponse.json(status);
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    const limited = rateLimit(`video-status:${ip}`, 20, 60_000);
    if (!limited.ok) {
      logger.warn("Rate limited /api/video-status", { ip, resetAt: limited.resetAt });
      return NextResponse.json(
        { error: "Terlalu banyak request, coba lagi nanti" },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((limited.resetAt - Date.now()) / 1000)),
          },
        }
      );
    }

    const body = await request.json();
    const requestId = typeof body?.requestId === "string" ? body.requestId : null;
    if (!requestId) {
      return NextResponse.json({ error: "requestId is required" }, { status: 400 });
    }

    logger.info("POST /api/video-status", { requestId });
    const started = await startVideoGeneration(requestId);
    return NextResponse.json(started);
  } catch (error) {
    logger.error("Error in video-status endpoint", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
