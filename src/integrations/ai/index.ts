import { createChatCompletion } from "./ai.service";
import type { ChatMessage } from "./ai.types";
import { logger } from "@/lib/logger";
import { z } from "zod";

function summarizeText(value: string) {
  const trimmed = value.trim();
  return {
    length: trimmed.length,
    preview: trimmed.slice(0, 220),
  };
}

function getAIConfig() {
  const apiKey = process.env.AI_API_KEY ?? "";
  const model = process.env.AI_MODEL ?? "gemini-2.0-flash";
  const baseUrl = process.env.AI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta";

  if (!apiKey) {
    throw new Error("AI_API_KEY environment variable is not set");
  }

  return { apiKey, model, baseUrl };
}

export interface AICandidatesResult {
  candidates: Array<{
    id: string;
    nama_makanan: string;
    deskripsi_singkat: string;
  }>;
}

export interface AIDetailResult {
  nama_makanan: string;
  deskripsi_detail: string;
  karakter_rasa: string[];
  tekstur: string;
  bahan_utama: string[];
  resep_bahan: string[];
  langkah_memasak: string[];
  cocok_untuk: string;
  deskripsi_visual: string;
}

const CandidateSchema = z.object({
  id: z.string().min(1),
  nama_makanan: z.string().min(1),
  deskripsi_singkat: z.string().min(1),
});

const CandidatesResponseBaseSchema = z.object({
  candidates: z.array(CandidateSchema).min(1).max(3),
});

const CandidatesResponseSchema: z.ZodType<AICandidatesResult, z.ZodTypeDef, unknown> = z.preprocess(
  (input) => {
  if (!input || typeof input !== "object") return input;
  const obj = input as Record<string, unknown>;
  const rawCandidates =
    (obj.candidates as unknown) ??
    (obj.kandidat as unknown) ??
    (obj.foods as unknown) ??
    (obj.items as unknown);

  if (!Array.isArray(rawCandidates)) return input;

  const candidates = rawCandidates
    .slice(0, 3)
    .map((c, index) => {
      const candidate = (c ?? {}) as Record<string, unknown>;
      const id = String(candidate.id ?? `food-${index + 1}`);
      const nama = String(
        candidate.nama_makanan ??
          candidate.namaMakanan ??
          candidate.nama ??
          candidate.name ??
          ""
      ).trim();
      const deskripsi = String(
        candidate.deskripsi_singkat ??
          candidate.deskripsiSingkat ??
          candidate.deskripsi ??
          candidate.description ??
          ""
      ).trim();

      return {
        id,
        nama_makanan: nama,
        deskripsi_singkat: deskripsi,
      };
    })
    .filter((c) => c.nama_makanan.length > 0 && c.deskripsi_singkat.length > 0);

  return { candidates };
  },
  CandidatesResponseBaseSchema
);

const DetailResponseSchema = z.object({
  nama_makanan: z.string().min(1),
  deskripsi_detail: z.string().min(1),
  karakter_rasa: z.array(z.string().min(1)).min(1),
  tekstur: z.string().min(1),
  bahan_utama: z.array(z.string().min(1)).min(1),
  resep_bahan: z.array(z.string().min(1)).min(1),
  langkah_memasak: z.array(z.string().min(1)).min(1),
  cocok_untuk: z.string().min(1),
  deskripsi_visual: z.string().min(1),
});

function extractJsonFromResponse(response: string): string {
  const jsonMatch =
    response.match(/```json\s*([\s\S]*?)\s*```/) ?? response.match(/\{[\s\S]*\}/);
  return jsonMatch ? (jsonMatch[1] ?? response) : response;
}

function safeJsonParse(
  value: string
): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(value) as unknown };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function repairToValidJson(
  rawResponse: string,
  schemaName: "kandidat" | "detail"
): Promise<string> {
  const truncated =
    rawResponse.length > 6000 ? `${rawResponse.slice(0, 6000)}...` : rawResponse;

  const repairMessages: ChatMessage[] = [
    {
      role: "user",
      content: `Anda adalah asisten yang memperbaiki output agar menjadi JSON valid sesuai instruksi. Jangan gunakan reasoning/thinking.

${
  schemaName === "kandidat"
    ? `Perbaiki output berikut agar menjadi JSON valid untuk kandidat. Wajib maksimal 3 item. deskripsi_singkat maksimal 8 kata per item. Output harus berupa satu objek JSON saja.\n\n${truncated}`
    : `Perbaiki output berikut agar menjadi JSON valid untuk detail. Output harus berupa satu objek JSON saja.\n\n${truncated}`
}`,
    },
  ];

  const repairMaxTokens = schemaName === "detail" ? 3000 : 1500;
  return callAI(repairMessages, { temperature: 0, maxTokens: repairMaxTokens });
}

async function parseAndValidate<T>(
  responseText: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  schemaName: "kandidat" | "detail"
): Promise<T> {
  const cleaned = extractJsonFromResponse(responseText);
  logger.info("Parsing AI response", {
    schemaName,
    raw: summarizeText(responseText),
    cleaned: summarizeText(cleaned),
  });

  const firstParsed = safeJsonParse(cleaned);
  if (firstParsed.ok) {
    const validated = schema.safeParse(firstParsed.value);
    if (validated.success) {
      return validated.data;
    }
    logger.warn("AI response schema mismatch, attempting repair", { schemaName });
  } else {
    logger.warn("AI response JSON parse failed, attempting repair", {
      schemaName,
      error: firstParsed.error,
    });
  }

  if (schemaName === "kandidat") {
    throw new Error(
      `AI response tidak valid untuk ${schemaName} (parse error: ${
        firstParsed.ok ? "schema mismatch" : firstParsed.error
      })`
    );
  }

  const repaired1 = await repairToValidJson(cleaned, schemaName);
  const repaired1Cleaned = extractJsonFromResponse(repaired1);
  logger.info("AI repair attempt 1 done", {
    schemaName,
    repaired: summarizeText(repaired1),
    cleaned: summarizeText(repaired1Cleaned),
  });
  const repaired1Parsed = safeJsonParse(repaired1Cleaned);
  if (repaired1Parsed.ok) {
    const repaired1Validated = schema.safeParse(repaired1Parsed.value);
    if (repaired1Validated.success) {
      return repaired1Validated.data;
    }
    logger.warn("AI repair attempt 1 schema mismatch", { schemaName });
  } else {
    logger.warn("AI repair attempt 1 JSON parse failed", {
      schemaName,
      error: repaired1Parsed.error,
    });
  }

  const repaired2 = await repairToValidJson(repaired1Cleaned, schemaName);
  const repaired2Cleaned = extractJsonFromResponse(repaired2);
  logger.info("AI repair attempt 2 done", {
    schemaName,
    repaired: summarizeText(repaired2),
    cleaned: summarizeText(repaired2Cleaned),
  });
  const repaired2Parsed = safeJsonParse(repaired2Cleaned);
  if (repaired2Parsed.ok) {
    const repaired2Validated = schema.safeParse(repaired2Parsed.value);
    if (repaired2Validated.success) {
      return repaired2Validated.data;
    }
    logger.warn("AI repair attempt 2 schema mismatch", { schemaName });
  } else {
    logger.warn("AI repair attempt 2 JSON parse failed", {
      schemaName,
      error: repaired2Parsed.error,
    });
  }

  throw new Error(
    `AI response tidak valid untuk ${schemaName} (parse error: ${
      firstParsed.ok ? "schema mismatch" : firstParsed.error
    })`
  );
}

async function callAI(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const { apiKey, model, baseUrl } = getAIConfig();

  const userMessage = messages.findLast((m) => m.role === "user")?.content ?? "";
  logger.info("Calling AI", {
    model,
    baseUrl,
    temperature: options?.temperature ?? 0.7,
    maxTokens: options?.maxTokens ?? 2048,
    userMessage: summarizeText(userMessage),
  });

  const response = await createChatCompletion(
    {
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2048,
    },
    apiKey,
    baseUrl,
    model
  );

  const content = response.choices[0]?.message?.content ?? "";
  if (content.trim().length === 0) {
    logger.warn("AI returned empty content", {
      model,
      baseUrl,
      finishReason: response.choices[0]?.finish_reason ?? null,
    });
  }
  logger.info("AI content received", {
    content: summarizeText(content),
  });
  return content;
}

const CANDIDATES_USER_TEMPLATE = `Anda adalah asisten kuliner Indonesia. Jangan gunakan reasoning/thinking.

Berdasarkan prompt berikut, berikan maksimal 3 kandidat makanan Indonesia yang cocok.

Prompt: {prompt}

Aturan:
- Output harus SATU objek JSON minified (1 baris)
- Tidak boleh ada markdown / penjelasan
- JANGAN GUNAKAN thinking atau reasoning
- Maksimal 3 kandidat
- id harus "food-1" sampai "food-3"
- deskripsi_singkat maksimal 8 kata

Format JSON:
{"candidates":[{"id":"food-1","nama_makanan":"...","deskripsi_singkat":"..."}]}`;

const DETAIL_USER_TEMPLATE = `Anda adalah asisten kuliner Indonesia yang knowledgeable. Jangan gunakan reasoning/thinking.

Berdasarkan makanan yang dipilih user, berikan detail lengkap dalam Bahasa Indonesia.

Makanan yang dipilih: {foodName}
Prompt asli user: {prompt}

Format response必须是 JSON dengan struktur:
{{"nama_makanan": "nama makanan", "deskripsi_detail": "deskripsi detail 2-3 kalimat", "karakter_rasa": ["rasa1", "rasa2"], "tekstur": "deskripsi tekstur", "bahan_utama": ["bahan1", "bahan2"], "resep_bahan": ["bahan resep"], "langkah_memasak": ["langkah 1", "langkah 2"], "cocok_untuk": "kapan cocok dimakan", "deskripsi_visual": "deskripsi visual untuk video"}}

Hanya berikan JSON, tanpa text lain.`;

export async function getFoodCandidates(prompt: string): Promise<AICandidatesResult> {
  const messages: ChatMessage[] = [
    {
      role: "user",
      content: CANDIDATES_USER_TEMPLATE.replace("{prompt}", prompt),
    },
  ];

  logger.info("Getting food candidates from AI");

  const response = await callAI(messages, { temperature: 0.2, maxTokens: 1500 });

  try {
    return await parseAndValidate(response, CandidatesResponseSchema, "kandidat");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("Unexpected end of JSON input") && !message.includes("AI response tidak valid")) {
      throw error;
    }

    const fallbackMessages: ChatMessage[] = [
      {
        role: "user",
        content: `Anda adalah asisten kuliner Indonesia. Buat ulang kandidat makanan yang cocok untuk prompt berikut.\n\nPrompt: ${prompt}\n\nWajib:\n- maksimal 3 item\n- deskripsi_singkat maksimal 6 kata\n- gunakan Bahasa Indonesia\n- JANGAN GUNAKAN thinking atau reasoning\n\nFormat JSON:\n{"candidates":[{"id":"food-1","nama_makanan":"...","deskripsi_singkat":"..."}]}`,
      },
    ];

    const fallback = await callAI(fallbackMessages, { temperature: 0, maxTokens: 1024 });
    return parseAndValidate(fallback, CandidatesResponseSchema, "kandidat");
  }
}

export async function getFoodDetail(
  foodName: string,
  originalPrompt: string
): Promise<AIDetailResult> {
  const messages: ChatMessage[] = [
    {
      role: "user",
      content: DETAIL_USER_TEMPLATE
        .replace("{foodName}", foodName)
        .replace("{prompt}", originalPrompt),
    },
  ];

  logger.info("Getting food detail from AI", { foodName });

  try {
    const response = await callAI(messages, { temperature: 0.2, maxTokens: 3000 });
    return await parseAndValidate(response, DetailResponseSchema, "detail");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn("First detail attempt failed, retrying with simplified prompt", {
      foodName,
      error: message,
    });

    const simplifiedMessages: ChatMessage[] = [
      {
        role: "user",
        content: `Anda adalah asisten kuliner Indonesia. Berikan detail makanan ini dalam Bahasa Indonesia. JANGAN gunakan thinking atau reasoning.

Makanan: ${foodName}
Prompt: ${originalPrompt}

Output JSON dengan field berikut (minified, 1 baris):
{"nama_makanan":"...","deskripsi_detail":"...","karakter_rasa":["rasa1","rasa2"],"tekstur":"...","bahan_utama":["bahan1","bahan2"],"resep_bahan":["bahan1","bahan2"],"langkah_memasak":["langkah1","langkah2"],"cocok_untuk":"...","deskripsi_visual":"..."}

Hanya JSON, tanpa teks lain.`,
      },
    ];

    const fallback = await callAI(simplifiedMessages, { temperature: 0, maxTokens: 3000 });
    return parseAndValidate(fallback, DetailResponseSchema, "detail");
  }
}
