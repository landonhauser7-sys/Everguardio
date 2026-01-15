import { NextResponse } from "next/server";
import { sendDiscordSaleNotification } from "@/lib/discord";

export const dynamic = "force-dynamic";

export async function GET() {
  const webhookUrl = process.env.DISCORD_SALES_WEBHOOK_URL;

  return NextResponse.json({
    hasWebhook: !!webhookUrl,
    webhookPrefix: webhookUrl ? webhookUrl.substring(0, 50) + "..." : null,
  });
}

export async function POST() {
  const webhookUrl = process.env.DISCORD_SALES_WEBHOOK_URL;

  if (!webhookUrl) {
    return NextResponse.json({
      error: "DISCORD_SALES_WEBHOOK_URL not configured",
      help: "Add DISCORD_SALES_WEBHOOK_URL to your Netlify environment variables"
    }, { status: 400 });
  }

  try {
    await sendDiscordSaleNotification({
      deal: {
        id: "test-deal-123",
        clientName: "Test Client",
        annualPremium: 1500,
        insuranceType: "LIFE",
        carrierName: "Test Carrier",
      },
      agent: {
        id: "test-agent",
        firstName: "Test",
        lastName: "Agent",
      },
      totalAgentDeals: 10,
      totalDealsToday: 5,
    });

    return NextResponse.json({
      success: true,
      message: "Test notification sent to Discord"
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
