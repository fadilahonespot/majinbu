import { execSync } from "child_process";
import { NextResponse } from "next/server";
import { prisma } from "@/db/prisma";

export async function GET() {
  let pixverseCli = false;
  try {
    execSync("which pixverse", { encoding: "utf-8", timeout: 2000 });
    pixverseCli = true;
  } catch {
    // CLI not available
  }

  const checks = {
    database: "unknown" as "ok" | "error" | "unknown",
    ai: Boolean(process.env.AI_API_KEY && process.env.AI_MODEL),
    pexels: Boolean(process.env.PEXELS_API_KEY),
    pixverse: pixverseCli,
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  const ok = checks.database === "ok";
  return NextResponse.json(
    { status: ok ? "ok" : "degraded", checks, timestamp: new Date().toISOString() },
    { status: ok ? 200 : 503 }
  );
}
