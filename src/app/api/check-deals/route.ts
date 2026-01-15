import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const dealCount = await prisma.deals.count();
    const recentDeals = await prisma.deals.findMany({
      take: 5,
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        client_name: true,
        created_at: true,
        agent_id: true,
      },
    });

    return NextResponse.json({
      totalDeals: dealCount,
      recentDeals,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
