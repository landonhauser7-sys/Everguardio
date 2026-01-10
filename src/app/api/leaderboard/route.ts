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
    const insuranceType = searchParams.get("insuranceType"); // "LIFE", "HEALTH", or null for both
    const teamId = searchParams.get("teamId"); // filter by team
    const sortBy = searchParams.get("sortBy") || "premium"; // "premium", "deals", "avgDeal"

    const dateFilter = {
      created_at: {
        gte: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        lte: endDate ? new Date(endDate) : new Date(),
      },
    };

    // Build deals filter
    const dealsFilter: Record<string, unknown> = { ...dateFilter };
    if (insuranceType && (insuranceType === "LIFE" || insuranceType === "HEALTH")) {
      dealsFilter.insurance_type = insuranceType;
    }

    // Get all deals in the date range
    const deals = await prisma.deals.findMany({
      where: dealsFilter,
      include: {
        users_deals_agent_idTousers: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            profile_photo_url: true,
            team_id: true,
            teams_users_team_idToteams: {
              select: {
                id: true,
                name: true,
                emoji: true,
                color: true,
              },
            },
          },
        },
      },
    });

    // Aggregate by agent
    const agentMap = new Map<
      string,
      {
        agentId: string;
        agentName: string;
        firstName: string;
        lastName: string;
        profilePhotoUrl: string | null;
        teamId: string | null;
        teamName: string | null;
        teamEmoji: string | null;
        teamColor: string | null;
        totalPremium: number;
        totalCommission: number;
        dealCount: number;
        lifeDeals: number;
        healthDeals: number;
        lifePremium: number;
        healthPremium: number;
      }
    >();

    deals.forEach((deal) => {
      const agent = deal.users_deals_agent_idTousers;

      // Filter by team if specified
      if (teamId && agent.team_id !== teamId) {
        return;
      }

      const existing = agentMap.get(agent.id) || {
        agentId: agent.id,
        agentName: `${agent.first_name} ${agent.last_name}`,
        firstName: agent.first_name,
        lastName: agent.last_name,
        profilePhotoUrl: agent.profile_photo_url,
        teamId: agent.team_id,
        teamName: agent.teams_users_team_idToteams?.name || null,
        teamEmoji: agent.teams_users_team_idToteams?.emoji || null,
        teamColor: agent.teams_users_team_idToteams?.color || null,
        totalPremium: 0,
        totalCommission: 0,
        dealCount: 0,
        lifeDeals: 0,
        healthDeals: 0,
        lifePremium: 0,
        healthPremium: 0,
      };

      existing.totalPremium += Number(deal.annual_premium);
      existing.totalCommission += Number(deal.commission_amount);
      existing.dealCount += 1;

      if (deal.insurance_type === "LIFE") {
        existing.lifeDeals += 1;
        existing.lifePremium += Number(deal.annual_premium);
      } else if (deal.insurance_type === "HEALTH") {
        existing.healthDeals += 1;
        existing.healthPremium += Number(deal.annual_premium);
      }

      agentMap.set(agent.id, existing);
    });

    // Sort based on sortBy parameter
    let rankings = Array.from(agentMap.values());

    switch (sortBy) {
      case "deals":
        rankings.sort((a, b) => b.dealCount - a.dealCount);
        break;
      case "avgDeal":
        rankings.sort((a, b) => {
          const avgA = a.dealCount > 0 ? a.totalPremium / a.dealCount : 0;
          const avgB = b.dealCount > 0 ? b.totalPremium / b.dealCount : 0;
          return avgB - avgA;
        });
        break;
      default:
        rankings.sort((a, b) => b.totalPremium - a.totalPremium);
    }

    // Add ranks and calculate avg deal
    const rankingsWithMeta = rankings.map((agent, index) => ({
      rank: index + 1,
      ...agent,
      avgDealSize: agent.dealCount > 0 ? agent.totalPremium / agent.dealCount : 0,
    }));

    // Get available teams for filter
    const teams = await prisma.teams.findMany({
      select: {
        id: true,
        name: true,
        emoji: true,
      },
      orderBy: { name: "asc" },
    });

    // Calculate summary stats
    const totalAgents = rankingsWithMeta.length;
    const totalDeals = rankingsWithMeta.reduce((sum, r) => sum + r.dealCount, 0);
    const totalPremium = rankingsWithMeta.reduce((sum, r) => sum + r.totalPremium, 0);
    const avgDealsPerAgent = totalAgents > 0 ? totalDeals / totalAgents : 0;

    return NextResponse.json({
      rankings: rankingsWithMeta,
      currentUserId: session.user.id,
      teams: teams.map((t) => ({ id: t.id, name: t.name, emoji: t.emoji })),
      summary: {
        totalAgents,
        totalDeals,
        totalPremium,
        avgDealsPerAgent,
      },
    });
  } catch (error) {
    console.error("Leaderboard error:", error);
    return NextResponse.json({ message: "Failed to fetch leaderboard" }, { status: 500 });
  }
}
