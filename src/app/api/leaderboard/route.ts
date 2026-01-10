import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const dateFilter = {
      created_at: {
        gte: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        lte: endDate ? new Date(endDate) : new Date(),
      },
    };

    // Get all deals in the date range
    const deals = await prisma.deals.findMany({
      where: dateFilter,
      include: {
        users_deals_agent_idTousers: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            profile_photo_url: true,
            teams_users_team_idToteams: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    // Aggregate by agent
    const agentMap = new Map<string, {
      agentId: string;
      agentName: string;
      firstName: string;
      lastName: string;
      profilePhotoUrl: string | null;
      teamName: string | null;
      totalPremium: number;
      totalCommission: number;
      dealCount: number;
    }>();

    deals.forEach((deal) => {
      const agent = deal.users_deals_agent_idTousers;
      const existing = agentMap.get(agent.id) || {
        agentId: agent.id,
        agentName: `${agent.first_name} ${agent.last_name}`,
        firstName: agent.first_name,
        lastName: agent.last_name,
        profilePhotoUrl: agent.profile_photo_url,
        teamName: agent.teams_users_team_idToteams?.name || null,
        totalPremium: 0,
        totalCommission: 0,
        dealCount: 0,
      };

      existing.totalPremium += Number(deal.annual_premium);
      existing.totalCommission += Number(deal.commission_amount);
      existing.dealCount += 1;
      agentMap.set(agent.id, existing);
    });

    // Sort by premium and add ranks
    const rankings = Array.from(agentMap.values())
      .sort((a, b) => b.totalPremium - a.totalPremium)
      .map((agent, index) => ({
        rank: index + 1,
        ...agent,
        previousRank: null,
        rankChange: null,
      }));

    return NextResponse.json({
      rankings,
      currentUserId: session.user.id,
    });
  } catch (error) {
    console.error("Leaderboard error:", error);
    return NextResponse.json({ message: "Failed to fetch leaderboard" }, { status: 500 });
  }
}
