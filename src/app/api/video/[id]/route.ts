import { prisma } from "@/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const asset = await prisma.videoAsset.findUnique({
    where: { id },
  });

  if (!asset) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  if (!asset.videoPath) {
    if (asset.videoUrl) {
      return NextResponse.redirect(asset.videoUrl);
    }
    return NextResponse.json({ error: "Video not ready" }, { status: 404 });
  }

  try {
    const fileStat = await stat(asset.videoPath);
    if (!fileStat.isFile()) {
      return NextResponse.json({ error: "Video file missing" }, { status: 404 });
    }

    const stream = createReadStream(asset.videoPath);
    const webStream = Readable.toWeb(stream) as unknown as ReadableStream;

    return new NextResponse(webStream, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(fileStat.size),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    if (asset.videoUrl) {
      return NextResponse.redirect(asset.videoUrl);
    }
    return NextResponse.json({ error: "Video file missing" }, { status: 404 });
  }
}

