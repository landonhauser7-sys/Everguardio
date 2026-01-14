import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
    nextAuthUrl: process.env.NEXTAUTH_URL,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasDiscordWebhook: !!process.env.DISCORD_SALES_WEBHOOK_URL,
    nodeEnv: process.env.NODE_ENV,
  });
}
