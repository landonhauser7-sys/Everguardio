import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || "";

  // Extract host from DATABASE_URL (hide credentials)
  let host = "unknown";
  try {
    const match = dbUrl.match(/@([^/]+)/);
    if (match) {
      host = match[1];
    }
  } catch (e) {
    host = "parse-error";
  }

  return NextResponse.json({
    dbHost: host,
    nodeEnv: process.env.NODE_ENV,
  });
}
