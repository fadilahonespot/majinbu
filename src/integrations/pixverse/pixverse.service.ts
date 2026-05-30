import { execSync } from "child_process";
import { logger } from "@/lib/logger";

const CLI_BIN = "pixverse";

function runCLI(args: string): string {
  try {
    const stdout = execSync(`${CLI_BIN} ${args}`, {
      encoding: "utf-8",
      timeout: 600_000,
    });
    return stdout.trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`PixVerse CLI error: ${message}`);
  }
}

interface CLICreateResult {
  video_id: number;
  trace_id: string;
  status: string;
  cost_credits: number;
}

interface CLIStatusResult {
  id: number;
  type: string;
  status: string;
  status_code: number;
  prompt: string;
  video_url?: string;
  cover_url?: string;
  error?: string;
}

function parseJSON<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new Error(
      `Failed to parse PixVerse CLI output: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function mapStatus(cliStatus: string): "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" {
  const s = cliStatus.toLowerCase();
  if (s === "completed") return "COMPLETED";
  if (s === "failed" || s === "expired" || s === "cancelled") return "FAILED";
  if (s === "submitted" || s === "generating" || s === "processing") return "PROCESSING";
  return "PENDING";
}

export async function createVideoJob(
  prompt: string
): Promise<{ jobId: string }> {
  logger.info("Creating PixVerse video job via CLI", { prompt });

  const escapedPrompt = prompt.replace(/"/g, '\\"');
  const raw = runCLI(
    `create video --prompt "${escapedPrompt}" --duration 4 --aspect-ratio 16:9 --no-wait --json`
  );

  const result = parseJSON<CLICreateResult>(raw);
  const jobId = String(result.video_id);

  logger.info("PixVerse job created via CLI", { jobId, costCredits: result.cost_credits });
  return { jobId };
}

export async function getVideoJobStatus(
  jobId: string
): Promise<{ status: string; video_url?: string; error?: string }> {
  const raw = runCLI(`task status ${jobId} --json`);
  const result = parseJSON<CLIStatusResult>(raw);

  logger.debug("PixVerse job status", { jobId, cliStatus: result.status, apiStatus: mapStatus(result.status) });

  return {
    status: mapStatus(result.status),
    video_url: result.video_url,
    error: result.error,
  };
}

export async function pollVideoJob(
  jobId: string,
  maxAttempts: number = 60,
  intervalMs: number = 5000
): Promise<string> {
  logger.info("Starting PixVerse job poll via CLI", { jobId, maxAttempts });

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = await getVideoJobStatus(jobId);

    if (status.status === "COMPLETED" && status.video_url) {
      logger.info("PixVerse job completed", { jobId });
      return status.video_url;
    }

    if (status.status === "FAILED") {
      logger.error("PixVerse job failed", { jobId, error: status.error });
      throw new Error(`Video generation failed: ${status.error ?? "unknown error"}`);
    }

    logger.info("PixVerse job still processing", {
      jobId,
      attempt: attempt + 1,
    });

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Video generation timed out");
}

export async function generateVideo(prompt: string): Promise<string> {
  const { jobId } = await createVideoJob(prompt);
  const videoUrl = await pollVideoJob(jobId);
  return videoUrl;
}
