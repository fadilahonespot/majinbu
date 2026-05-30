import { logger } from "@/lib/logger";
import { buildImageSearchQuery, scoreImageResult } from "@/lib/scoring";
import type { PexelsSearchResponse, PexelsImageResult } from "./pexels.types";

const PEXELS_API_URL = "https://api.pexels.com/v1/search";

async function searchImages(
  query: string,
  perPage: number = 5
): Promise<PexelsSearchResponse> {
  const url = `${PEXELS_API_URL}?query=${encodeURIComponent(query)}&per_page=${perPage}`;

  const response = await fetch(url, {
    headers: {
      Authorization: process.env.PEXELS_API_KEY ?? "",
    },
  });

  if (!response.ok) {
    throw new Error(`Pexels API error: ${response.status}`);
  }

  return response.json();
}

function mapPexelsResult(result: PexelsImageResult) {
  return {
    url: result.src.large,
    alt: result.alt,
    width: result.width,
    height: result.height,
    photographer: result.photographer,
    photographerUrl: result.photographer_url,
  };
}

export async function findBestImageForFood(
  foodName: string,
  visualKeywords: string[] = []
): Promise<{ url: string; score: number; source: string }> {
  if (!process.env.PEXELS_API_KEY) {
    return getPlaceholderResult();
  }

  const query = buildImageSearchQuery(foodName, visualKeywords);

  logger.info("Searching Pexels for food image", { foodName, query });

  try {
    const data = await searchImages(query, 5);

    if (data.photos.length === 0) {
      logger.warn("No Pexels results found", { foodName, query });
      return getPlaceholderResult();
    }

    const scoredResults = data.photos.map((photo) => {
      const mapped = mapPexelsResult(photo);
      const score = scoreImageResult(mapped, foodName, visualKeywords);
      return { ...mapped, matchScore: score };
    });

    scoredResults.sort((a, b) => b.matchScore - a.matchScore);
    const best = scoredResults[0];

    logger.info("Best image found from Pexels", {
      foodName,
      imageUrl: best.url,
      score: best.matchScore,
    });

    if (best.matchScore < 30) {
      logger.warn("Best image score too low, using placeholder", {
        foodName,
        score: best.matchScore,
      });
      return getPlaceholderResult();
    }

    return {
      url: best.url,
      score: best.matchScore,
      source: "pexels",
    };
  } catch (error) {
    logger.error("Pexels search failed, using placeholder", {
      error: error instanceof Error ? error.message : String(error),
      foodName,
    });
    return getPlaceholderResult();
  }
}

function getPlaceholderResult() {
  return {
    url: "/images/placeholder-food.svg",
    score: 0,
    source: "placeholder",
  };
}
