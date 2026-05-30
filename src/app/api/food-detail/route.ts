import { NextRequest, NextResponse } from "next/server";
import { FoodDetailRequestSchema } from "@/features/food/food.schemas";
import {
  createFoodDetail,
  startVideoGeneration,
} from "@/features/food/food.service";
import { logger } from "@/lib/logger";
import { getClientIp, rateLimit } from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    const limited = rateLimit(`food-detail:${ip}`, 12, 60_000);
    if (!limited.ok) {
      logger.warn("Rate limited /api/food-detail", { ip, resetAt: limited.resetAt });
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
    const parsed = FoodDetailRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { requestId, prompt, selectedCandidateId } = parsed.data;

    logger.info("POST /api/food-detail", { requestId, selectedCandidateId });

    const detailResult = await createFoodDetail(requestId, selectedCandidateId, prompt);

    if (detailResult.videoStatus === "PENDING" || detailResult.videoStatus === null) {
      const started = await startVideoGeneration(requestId);
      detailResult.videoAssetId = started.videoAssetId;
      detailResult.videoStatus = started.status ?? "PENDING";
      detailResult.videoUrl = started.videoUrl;
    }

    return NextResponse.json(detailResult);
  } catch (error) {
    logger.error("Error in food-detail endpoint", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    const message = error instanceof Error ? error.message : "Internal server error";
    if (message.includes("AI response tidak valid")) {
      return NextResponse.json({ error: message }, { status: 502 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
