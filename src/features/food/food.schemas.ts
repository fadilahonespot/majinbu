import { z } from "zod";

export const FoodCandidatesRequestSchema = z.object({
  prompt: z.string().min(1).max(500),
});

export const FoodDetailRequestSchema = z.object({
  requestId: z.string().min(1),
  prompt: z.string().min(1).max(500),
  selectedCandidateId: z.string().min(1),
});

export const GeminiCandidateSchema = z.object({
  id: z.string(),
  nama_makanan: z.string(),
  deskripsi_singkat: z.string(),
});

export const GeminiCandidatesResponseSchema = z.object({
  candidates: z.array(GeminiCandidateSchema).max(3),
});

export const GeminiDetailResponseSchema = z.object({
  nama_makanan: z.string(),
  deskripsi_detail: z.string(),
  karakter_rasa: z.array(z.string()),
  tekstur: z.string(),
  bahan_utama: z.array(z.string()),
  resep_bahan: z.array(z.string()),
  langkah_memasak: z.array(z.string()),
  cocok_untuk: z.string(),
  deskripsi_visual: z.string(),
});

export type FoodCandidatesRequest = z.infer<typeof FoodCandidatesRequestSchema>;
export type FoodDetailRequest = z.infer<typeof FoodDetailRequestSchema>;
export type GeminiCandidate = z.infer<typeof GeminiCandidateSchema>;
export type GeminiCandidatesResponse = z.infer<typeof GeminiCandidatesResponseSchema>;
export type GeminiDetailResponse = z.infer<typeof GeminiDetailResponseSchema>;
