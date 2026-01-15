import { NextResponse } from "next/server";
import { getServerSession, authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@prisma/client";

// Get role label from commission level
function getRoleFromLevel(level: number): string {
  switch (level) {
    case 130: return "AO";
    case 120: return "Partner";
    case 110: return "MGA";
    case 100: return "GA";
    case 90: return "SA";
    case 80: return "BA";
    default: return "Prodigy";
  }
}

// Get all downline users recursively
async function getAllDownline(userId: string): Promise<Array<{
  id: string;
  commission_level: number;
  role: UserRole;
}>> {
  const directRecruits = await prisma.users.findMany({
    where: { upline_id: userId, status: "ACTIVE" },
    select: { id: true, commission_level: true, role: true },
  });

  const allDownline = [...directRecruits];

  for (const recruit of directRecruits) {
    const subDownline = await getAllDownline(recruit.id);
    allDownline.push(...subDownline);
  }

  return allDownline;
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Default to current month
    const now = new Date();
    const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const mtdEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // YTD dates
    const ytdStart = new Date(now.getFullYear(), 0, 1);

    const dateFilterMTD = {
      gte: startDate ? new Date(startDate) : mtdStart,
      lte: endDate ? new Date(endDate) : mtdEnd,
    };

    const dateFilterYTD = {
      gte: ytdStart,
      lte: mtdEnd,
    };

    // Get all downline
    const allDownline = await getAllDownline(session.user.id);
    const allDownlineIds = allDownline.map((d) => d.id);

    // Count by level
    const byLevel: Record<string, number> = {};
    for (const user of allDownline) {
      const level = getRoleFromLevel(user.commission_level);
      byLevel[level] = (byLevel[level] || 0) + 1;
    }

    // Get team production MTD
    const teamDealsMTD = await prisma.deals.findMany({
      where: {
        agent_id: { in: allDownlineIds },
        created_at: {
          gte: dateFilterMTD.gte,
          lte: dateFilterMTD.lte,
        },
      },
      select: {
        annual_premium: true,
        agent_id: true,
        users_deals_agent_idTousers: {
          select: { commission_level: true },
        },
      },
    });

    // Get team production YTD
    const teamDealsYTD = await prisma.deals.findMany({
      where: {
        agent_id: { in: allDownlineIds },
        created_at: {
          gte: dateFilterYTD.gte,
          lte: dateFilterYTD.lte,
        },
      },
      select: {
        annual_premium: true,
        agent_id: true,
        users_deals_agent_idTousers: {
          select: { commission_level: true },
        },
      },
    });

    const totalTeamProductionMTD = teamDealsMTD.reduce(
      (sum, d) => sum + Number(d.annual_premium),
      0
    );

    const totalTeamProductionYTD = teamDealsYTD.reduce(
      (sum, d) => sum + Number(d.annual_premium),
      0
    );

    // Get current user's commission level
    const currentUser = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { commission_level: true },
    });

    // Calculate override earned (simplified - 10% per level difference)
    let totalOverrideMTD = 0;
    let totalOverrideYTD = 0;

    if (currentUser) {
      for (const deal of teamDealsMTD) {
        const agentLevel = deal.users_deals_agent_idTousers.commission_level;
        const overridePercent = Math.min(10, currentUser.commission_level - agentLevel);
        if (overridePercent > 0) {
          totalOverrideMTD += Number(deal.annual_premium) * (overridePercent / 100);
        }
      }

      for (const deal of teamDealsYTD) {
        const agentLevel = deal.users_deals_agent_idTousers.commission_level;
        const overridePercent = Math.min(10, currentUser.commission_level - agentLevel);
        if (overridePercent > 0) {
          totalOverrideYTD += Number(deal.annual_premium) * (overridePercent / 100);
        }
      }
    }

    // Get direct recruits count
    const directRecruits = await prisma.users.count({
      where: { upline_id: session.user.id, status: "ACTIVE" },
    });

    return NextResponse.json({
      totalDownline: allDownline.length,
      directRecruits,
      byLevel,
      totalTeamProductionMTD,
      totalTeamProductionYTD,
      totalTeamDealsMTD: teamDealsMTD.length,
      totalTeamDealsYTD: teamDealsYTD.length,
      totalOverrideMTD,
      totalOverrideYTD,
    });
  } catch (error) {
    console.error("Error fetching hierarchy stats:", error);
    return NextResponse.json(
      { message: "Failed to fetch hierarchy stats" },
      { status: 500 }
    );
  }
}
