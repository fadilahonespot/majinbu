import { NextRequest, NextResponse } from "next/server";
import { FoodCandidatesRequestSchema } from "@/features/food/food.schemas";
import { createFoodCandidates, enrichCandidatesWithImages } from "@/features/food/food.service";
import { logger } from "@/lib/logger";
import { getClientIp, rateLimit } from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    const limited = rateLimit(`food-candidates:${ip}`, 10, 60_000);
    if (!limited.ok) {
      logger.warn("Rate limited /api/food-candidates", { ip, resetAt: limited.resetAt });
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
    const parsed = FoodCandidatesRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { prompt } = parsed.data;
    logger.info("POST /api/food-candidates", { prompt });

    const candidateResult = await createFoodCandidates(prompt);
    const enrichedResult = await enrichCandidatesWithImages(candidateResult.requestId);

    return NextResponse.json({
      candidates: enrichedResult.candidates,
      requestId: enrichedResult.requestId,
    });
  } catch (error) {
    logger.error("Error in food-candidates endpoint", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    const message = error instanceof Error ? error.message : "Internal server error";
    if (
      message.includes("AI response tidak valid") ||
      message.includes("AI API error") ||
      message.includes("AI response JSON parse error") ||
      message.includes("AI network error")
    ) {
      return NextResponse.json({ error: message }, { status: 502 });
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
