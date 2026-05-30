import { mkdir, writeFile } from "fs/promises";
import path from "path";

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

export function buildVideoFileName(videoAssetId: string, promptHash: string): string {
  const safeHash = promptHash.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24);
  return `${videoAssetId}-${safeHash}.mp4`;
}

export async function downloadToFile(
  url: string,
  outputFilePath: string
): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download video: ${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  await writeFile(outputFilePath, Buffer.from(arrayBuffer));
}

export function resolveVideoPath(storageRoot: string, fileName: string): string {
  return path.isAbsolute(storageRoot)
    ? path.join(storageRoot, fileName)
    : path.join(process.cwd(), storageRoot, fileName);
}
