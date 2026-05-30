export interface ImageSearchResult {
  url: string;
  alt: string;
  width: number;
  height: number;
  photographer: string;
  photographerUrl: string;
}

export interface ScoredImageResult extends ImageSearchResult {
  matchScore: number;
}

export function scoreImageResult(
  result: ImageSearchResult,
  foodName: string,
  searchTerms: string[]
): number {
  let score = 0;
  const altLower = result.alt.toLowerCase();
  const foodNameLower = foodName.toLowerCase();

  if (altLower.includes(foodNameLower)) {
    score += 50;
  }

  for (const term of searchTerms) {
    if (altLower.includes(term.toLowerCase())) {
      score += 15;
    }
  }

  const positiveTerms = ["food", "dish", "meal", "bowl", "plate", "indonesian food", "cuisine"];
  for (const term of positiveTerms) {
    if (altLower.includes(term)) {
      score += 10;
    }
  }

  const negativeTerms = ["person", "restaurant interior", "chef", "cooking show", "advertisement"];
  for (const term of negativeTerms) {
    if (altLower.includes(term)) {
      score -= 25;
    }
  }

  if (result.width >= 500 && result.height >= 500) {
    score += 5;
  }

  return Math.max(0, Math.min(100, score));
}

export function buildImageSearchQuery(foodName: string, visualKeywords: string[]): string {
  const parts = [foodName];
  if (visualKeywords.length > 0) {
    parts.push(...visualKeywords.slice(0, 2));
  }
  parts.push("food", "dish");
  return parts.join(" ");
}
