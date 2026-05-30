import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "@/lib/logger";
import type { GeminiCandidatesResult, GeminiDetailResult } from "./gemini.types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

const CANDIDATES_MODEL = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
const DETAIL_MODEL = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const CANDIDATES_PROMPT_TEMPLATE = `Anda adalah asisten kuliner Indonesia. Berdasarkan prompt berikut, berikan maksimal 3 kandidat makanan Indonesia yang cocok.

Prompt: {prompt}

Format response必须是 JSON dengan struktur:
{
  "candidates": [
    {
      "id": "food-1",
      "nama_makanan": "nama makanan",
      "deskripsi_singkat": "deskripsi singkat 1-2 kalimat"
    }
  ]
}

Hanya berikan JSON, tanpa text lain.`;

const DETAIL_PROMPT_TEMPLATE = `Anda adalah asisten kuliner Indonesia. Berdasarkan makanan yang dipilih user, berikan detail lengkap dalam Bahasa Indonesia.

Makanan yang dipilih: {foodName}
Prompt asli user: {prompt}

Format response必须是 JSON dengan struktur:
{
  "nama_makanan": "nama makanan",
  "deskripsi_detail": "deskripsi detail 2-3 kalimat tentang makanan ini",
  "karakter_rasa": ["rasa1", "rasa2"],
  "tekstur": "deskripsi tekstur makanan",
  "bahan_utama": ["bahan1", "bahan2", "bahan3"],
  "resep_bahan": ["bahan untuk resep"],
  "langkah_memasak": ["langkah 1", "langkah 2", "langkah 3"],
  "cocok_untuk": "kapan makanan ini cocok dimakan",
  "deskripsi_visual": "deskripsi visual untuk generate video pendek, fokus ke tampilan makanan yang appetizing"
}

Hanya berikan JSON, tanpa text lain.`;

function buildCandidatesPrompt(prompt: string): string {
  return CANDIDATES_PROMPT_TEMPLATE.replace("{prompt}", prompt);
}

function buildDetailPrompt(foodName: string, originalPrompt: string): string {
  return DETAIL_PROMPT_TEMPLATE
    .replace("{foodName}", foodName)
    .replace("{prompt}", originalPrompt);
}

function extractJsonFromResponse(response: string): string {
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) ?? response.match(/\{[\s\S]*\}/);
  return jsonMatch ? jsonMatch[1] ?? response : response;
}

export async function getFoodCandidates(prompt: string): Promise<GeminiCandidatesResult> {
  const modelPrompt = buildCandidatesPrompt(prompt);

  logger.info("Calling Gemini for food candidates", { prompt });

  try {
    const result = await CANDIDATES_MODEL.generateContent(modelPrompt);
    const response = result.response;
    const text = response.text();
    const cleanedText = extractJsonFromResponse(text);

    const parsed = JSON.parse(cleanedText);
    const candidates = parsed.candidates ?? [];

    if (candidates.length > 3) {
      candidates.length = 3;
    }

    logger.info("Gemini candidates received", { count: candidates.length });
    return { candidates };
  } catch (error) {
    logger.error("Failed to get candidates from Gemini", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function getFoodDetail(
  foodName: string,
  originalPrompt: string
): Promise<GeminiDetailResult> {
  const modelPrompt = buildDetailPrompt(foodName, originalPrompt);

  logger.info("Calling Gemini for food detail", { foodName });

  try {
    const result = await DETAIL_MODEL.generateContent(modelPrompt);
    const response = result.response;
    const text = response.text();
    const cleanedText = extractJsonFromResponse(text);

    const parsed = JSON.parse(cleanedText);

    logger.info("Gemini detail received", { foodName });
    return parsed;
  } catch (error) {
    logger.error("Failed to get detail from Gemini", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
