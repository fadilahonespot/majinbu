import { prisma } from "@/db/prisma";
import { generatePromptHash } from "@/lib/hash";
import { getFoodCandidates, getFoodDetail } from "@/integrations/ai";
import { findBestImageForFood } from "@/integrations/pexels/pexels.service";
import { createVideoJob, pollVideoJob } from "@/integrations/pixverse/pixverse.service";
import { logger } from "@/lib/logger";
import type { FoodCandidatesResponse, FoodDetailResponse } from "./food.types";
import { buildVideoFileName, downloadToFile, ensureDir, resolveVideoPath } from "@/lib/storage";

function extractVisualKeywords(text: string): string[] {
  const stopwords = new Set([
    "yang",
    "dan",
    "dengan",
    "untuk",
    "saat",
    "atau",
    "di",
    "ke",
    "dari",
    "ini",
    "itu",
    "paling",
    "cocok",
    "banget",
    "enak",
    "lezat",
    "gurih",
    "pedas",
    "manis",
    "asin",
    "asli",
    "khas",
    "ala",
  ]);

  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\u00C0-\u024F\u1E00-\u1EFF\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3)
    .filter((t) => !stopwords.has(t));

  const unique: string[] = [];
  for (const t of tokens) {
    if (!unique.includes(t)) {
      unique.push(t);
    }
    if (unique.length >= 4) break;
  }

  return unique;
}

export async function createFoodCandidates(
  prompt: string
): Promise<FoodCandidatesResponse> {
  const promptHash = generatePromptHash(prompt);

  const existingRequest = await prisma.foodRequest.findFirst({
    where: { promptHash },
    include: {
      candidates: true,
    },
  });

  if (existingRequest && existingRequest.candidates.length > 0) {
    logger.info("Returning cached candidates", {
      requestId: existingRequest.id,
      count: existingRequest.candidates.length,
    });

    return {
      requestId: existingRequest.id,
      candidates: existingRequest.candidates.map((c: { id: string; candidateKey: string; namaMakanan: string; deskripsiSingkat: string; foodImageUrl: string | null; foodImageSource: string | null; foodImageMatchScore: number | null }) => ({
        id: c.id,
        candidateKey: c.candidateKey,
        namaMakanan: c.namaMakanan,
        deskripsiSingkat: c.deskripsiSingkat,
        foodImageUrl: c.foodImageUrl,
        foodImageSource: c.foodImageSource,
        foodImageMatchScore: c.foodImageMatchScore,
      })),
    };
  }

  logger.info("Generating new candidates from AI", { prompt });
  const geminiResult = await getFoodCandidates(prompt);

  const request = await prisma.foodRequest.create({
    data: {
      prompt,
      promptHash,
      candidates: {
        create: geminiResult.candidates.map((c) => ({
          candidateKey: c.id,
          namaMakanan: c.nama_makanan,
          deskripsiSingkat: c.deskripsi_singkat,
        })),
      },
    },
    include: { candidates: true },
  });

  logger.info("Candidates saved to database", {
    requestId: request.id,
    count: request.candidates.length,
  });

  return {
    requestId: request.id,
    candidates: request.candidates.map((c: { id: string; candidateKey: string; namaMakanan: string; deskripsiSingkat: string }) => ({
      id: c.id,
      candidateKey: c.candidateKey,
      namaMakanan: c.namaMakanan,
      deskripsiSingkat: c.deskripsiSingkat,
      foodImageUrl: null,
      foodImageSource: null,
      foodImageMatchScore: null,
    })),
  };
}

export async function enrichCandidatesWithImages(
  requestId: string
): Promise<FoodCandidatesResponse> {
  const request = await prisma.foodRequest.findUnique({
    where: { id: requestId },
    include: { candidates: true },
  });

  if (!request) {
    throw new Error("Request not found");
  }

  const enrichedCandidates = await Promise.all(
    request.candidates.map(async (candidate: { id: string; candidateKey: string; namaMakanan: string; deskripsiSingkat: string; foodImageUrl: string | null; foodImageSource: string | null; foodImageMatchScore: number | null }) => {
      if (candidate.foodImageUrl) {
        return {
          id: candidate.id,
          candidateKey: candidate.candidateKey,
          namaMakanan: candidate.namaMakanan,
          deskripsiSingkat: candidate.deskripsiSingkat,
          foodImageUrl: candidate.foodImageUrl,
          foodImageSource: candidate.foodImageSource,
          foodImageMatchScore: candidate.foodImageMatchScore,
        };
      }

      const keywords = extractVisualKeywords(candidate.deskripsiSingkat);
      const imageResult = await findBestImageForFood(candidate.namaMakanan, keywords);

      const updated = await prisma.foodCandidate.update({
        where: { id: candidate.id },
        data: {
          foodImageUrl: imageResult.url,
          foodImageSource: imageResult.source,
          foodImageMatchScore: imageResult.score,
        },
      });

      return {
        id: updated.id,
        candidateKey: updated.candidateKey,
        namaMakanan: updated.namaMakanan,
        deskripsiSingkat: updated.deskripsiSingkat,
        foodImageUrl: updated.foodImageUrl,
        foodImageSource: updated.foodImageSource,
        foodImageMatchScore: updated.foodImageMatchScore,
      };
    })
  );

  return {
    requestId: request.id,
    candidates: enrichedCandidates,
  };
}

export async function createFoodDetail(
  requestId: string,
  selectedCandidateId: string,
  originalPrompt: string
): Promise<FoodDetailResponse> {
  const selectedCandidate = await prisma.foodCandidate.findFirst({
    where: {
      id: selectedCandidateId,
      requestId,
    },
  });

  if (!selectedCandidate) {
    throw new Error("Selected candidate not found for request");
  }

  const selectedFoodName = selectedCandidate.namaMakanan;
  const promptHash = generatePromptHash(`${originalPrompt}:${selectedFoodName}`);

  const existingDetail = await prisma.foodDetail.findUnique({
    where: { requestId },
    include: { videoAsset: true },
  });

  if (existingDetail) {
    if (existingDetail.namaMakanan !== selectedFoodName) {
      logger.info("Existing detail is for a different candidate, replacing", {
        requestId,
        existing: existingDetail.namaMakanan,
        selected: selectedFoodName,
      });
      await prisma.videoAsset.deleteMany({ where: { detailId: existingDetail.id } });
      await prisma.foodDetail.delete({ where: { requestId } });
    } else {
      logger.info("Returning cached food detail", { requestId });

      const videoUrl = existingDetail.videoAsset?.videoPath
        ? `/api/video/${existingDetail.videoAsset.id}`
        : existingDetail.videoAsset?.videoUrl ?? null;

      return {
        namaMakanan: existingDetail.namaMakanan,
        deskripsiDetail: existingDetail.deskripsiDetail,
        karakterRasa: existingDetail.karakterRasa as string[],
        tekstur: existingDetail.tekstur,
        bahanUtama: existingDetail.bahanUtama as string[],
        resepBahan: existingDetail.resepBahan as string[],
        langkahMemasak: existingDetail.langkahMemasak as string[],
        cocokUntuk: existingDetail.cocokUntuk,
        deskripsiVisual: existingDetail.deskripsiVisual,
        videoAssetId: existingDetail.videoAsset?.id ?? null,
        videoUrl,
        videoStatus: existingDetail.videoAsset?.status ?? null,
        videoErrorMessage: existingDetail.videoAsset?.errorMessage ?? null,
        source: "cache",
      };
    }
  }

  const cachedDetail = await prisma.foodDetail.findFirst({
    where: { promptHash },
    include: { videoAsset: true },
  });

  if (cachedDetail) {
    logger.info("Returning cached food detail by promptHash", {
      requestId,
      promptHash,
    });

    const cloned = await prisma.foodDetail.create({
      data: {
        requestId,
        promptHash,
        namaMakanan: cachedDetail.namaMakanan,
        deskripsiDetail: cachedDetail.deskripsiDetail,
        karakterRasa: cachedDetail.karakterRasa,
        tekstur: cachedDetail.tekstur,
        bahanUtama: cachedDetail.bahanUtama,
        resepBahan: cachedDetail.resepBahan,
        langkahMemasak: cachedDetail.langkahMemasak,
        cocokUntuk: cachedDetail.cocokUntuk,
        deskripsiVisual: cachedDetail.deskripsiVisual,
        videoAsset: {
          create: {
            promptHash,
            status: cachedDetail.videoAsset?.status ?? "PENDING",
            videoUrl: cachedDetail.videoAsset?.videoUrl ?? null,
            videoPath: cachedDetail.videoAsset?.videoPath ?? null,
            jobId: cachedDetail.videoAsset?.jobId ?? null,
            errorMessage: cachedDetail.videoAsset?.errorMessage ?? null,
          },
        },
      },
      include: { videoAsset: true },
    });

    const videoUrl = cloned.videoAsset?.videoPath
      ? `/api/video/${cloned.videoAsset.id}`
      : cloned.videoAsset?.videoUrl ?? null;

    return {
      namaMakanan: cloned.namaMakanan,
      deskripsiDetail: cloned.deskripsiDetail,
      karakterRasa: cloned.karakterRasa as string[],
      tekstur: cloned.tekstur,
      bahanUtama: cloned.bahanUtama as string[],
      resepBahan: cloned.resepBahan as string[],
      langkahMemasak: cloned.langkahMemasak as string[],
      cocokUntuk: cloned.cocokUntuk,
      deskripsiVisual: cloned.deskripsiVisual,
      videoAssetId: cloned.videoAsset?.id ?? null,
      videoUrl,
      videoStatus: cloned.videoAsset?.status ?? null,
      videoErrorMessage: cloned.videoAsset?.errorMessage ?? null,
      source: "cache",
    };
  }

  logger.info("Generating new food detail from AI", { requestId, selectedFoodName });

  const geminiResult = await getFoodDetail(selectedFoodName, originalPrompt);

  const detail = await prisma.foodDetail.create({
    data: {
      requestId,
      promptHash,
      namaMakanan: geminiResult.nama_makanan,
      deskripsiDetail: geminiResult.deskripsi_detail,
      karakterRasa: geminiResult.karakter_rasa,
      tekstur: geminiResult.tekstur,
      bahanUtama: geminiResult.bahan_utama,
      resepBahan: geminiResult.resep_bahan,
      langkahMemasak: geminiResult.langkah_memasak,
      cocokUntuk: geminiResult.cocok_untuk,
      deskripsiVisual: geminiResult.deskripsi_visual,
      videoAsset: {
        create: {
          promptHash,
          status: "PENDING",
        },
      },
    },
    include: { videoAsset: true },
  });

  logger.info("Food detail saved to database", {
    requestId,
    detailId: detail.id,
  });

  return {
    namaMakanan: detail.namaMakanan,
    deskripsiDetail: detail.deskripsiDetail,
    karakterRasa: detail.karakterRasa as string[],
    tekstur: detail.tekstur,
    bahanUtama: detail.bahanUtama as string[],
    resepBahan: detail.resepBahan as string[],
    langkahMemasak: detail.langkahMemasak as string[],
    cocokUntuk: detail.cocokUntuk,
    deskripsiVisual: detail.deskripsiVisual,
    videoAssetId: detail.videoAsset?.id ?? null,
    videoUrl: null,
    videoStatus: "PENDING",
    videoErrorMessage: null,
    source: "generated",
  };
}

export async function getVideoStatusByRequestId(requestId: string): Promise<{
  videoAssetId: string | null;
  status: string | null;
  videoUrl: string | null;
  errorMessage: string | null;
}> {
  const detail = await prisma.foodDetail.findUnique({
    where: { requestId },
    include: { videoAsset: true },
  });

  if (!detail?.videoAsset) {
    return { videoAssetId: null, status: null, videoUrl: null, errorMessage: null };
  }

  const url = detail.videoAsset.videoPath
    ? `/api/video/${detail.videoAsset.id}`
    : detail.videoAsset.videoUrl ?? null;

  return {
    videoAssetId: detail.videoAsset.id,
    status: detail.videoAsset.status,
    videoUrl: url,
    errorMessage: detail.videoAsset.errorMessage,
  };
}

export async function startVideoGeneration(
  requestId: string
): Promise<{ videoAssetId: string | null; status: string | null; videoUrl: string | null }> {
  const current = await getVideoStatusByRequestId(requestId);
  if (!current.videoAssetId || !current.status) return current;

  if (current.status === "COMPLETED") return current;

  if (current.status === "PROCESSING") return current;

  await prisma.videoAsset.update({
    where: { id: current.videoAssetId },
    data: { status: "PROCESSING", errorMessage: null },
  });

  void processVideoGeneration(requestId);

  return { ...current, status: "PROCESSING", videoUrl: null };
}

export async function processVideoGeneration(
  requestId: string
): Promise<{ videoUrl: string; status: string }> {
  const detail = await prisma.foodDetail.findUnique({
    where: { requestId },
    include: { videoAsset: true },
  });

  if (!detail || !detail.videoAsset) {
    throw new Error("Food detail or video asset not found");
  }

  if (detail.videoAsset.status === "COMPLETED") {
    return {
      videoUrl: detail.videoAsset.videoPath ? `/api/video/${detail.videoAsset.id}` : detail.videoAsset.videoUrl ?? "",
      status: "COMPLETED",
    };
  }

  await prisma.videoAsset.update({
    where: { id: detail.videoAsset.id },
    data: { status: "PROCESSING", errorMessage: null },
  });

  try {
    const currentAsset = await prisma.videoAsset.findUnique({
      where: { id: detail.videoAsset.id },
    });

    const ensuredJobId =
      currentAsset?.jobId ?? (await createVideoJob(detail.deskripsiVisual)).jobId;

    if (!currentAsset?.jobId) {
      await prisma.videoAsset.update({
        where: { id: detail.videoAsset.id },
        data: { jobId: ensuredJobId },
      });
    }

    const remoteVideoUrl = await pollVideoJob(ensuredJobId);

    const storageRoot = process.env.VIDEO_STORAGE_PATH ?? "./storage/videos";
    await ensureDir(resolveVideoPath(storageRoot, ""));
    const fileName = buildVideoFileName(detail.videoAsset.id, detail.videoAsset.promptHash);
    const absolutePath = resolveVideoPath(storageRoot, fileName);

    try {
      await downloadToFile(remoteVideoUrl, absolutePath);
      await prisma.videoAsset.update({
        where: { id: detail.videoAsset.id },
        data: {
          videoUrl: remoteVideoUrl,
          videoPath: absolutePath,
          status: "COMPLETED",
        },
      });
    } catch (downloadError) {
      await prisma.videoAsset.update({
        where: { id: detail.videoAsset.id },
        data: {
          videoUrl: remoteVideoUrl,
          status: "COMPLETED",
          errorMessage:
            downloadError instanceof Error ? downloadError.message : String(downloadError),
        },
      });
    }

    logger.info("Video generation completed", {
      requestId,
      jobId: ensuredJobId,
    });

    return { videoUrl: `/api/video/${detail.videoAsset.id}`, status: "COMPLETED" };
  } catch (error) {
    await prisma.videoAsset.update({
      where: { id: detail.videoAsset.id },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });

    throw error;
  }
}
