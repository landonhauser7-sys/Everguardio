import { NextResponse } from "next/server";
import { getServerSession, authOptions } from "@/lib/auth";
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

    // Get the current user's team and commission level
    const currentUser = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        team_id: true,
        role: true,
        commission_level: true,
        teams_users_team_idToteams: {
          select: {
            id: true,
            name: true,
            emoji: true,
            color: true,
            monthly_deal_goal: true,
            monthly_premium_goal: true,
          },
        },
      },
    });

    if (!currentUser?.team_id) {
      return NextResponse.json({
        team: null,
        members: [],
        stats: null,
        recentDeals: [],
        message: "You are not assigned to a team",
      });
    }

    const team = currentUser.teams_users_team_idToteams;

    // Get all team members
    const teamMembers = await prisma.users.findMany({
      where: {
        team_id: currentUser.team_id,
        status: "ACTIVE",
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        role: true,
        commission_level: true,
        profile_photo_url: true,
      },
      orderBy: { first_name: "asc" },
    });

    // Get all deals for the team in the date range
    const teamDeals = await prisma.deals.findMany({
      where: {
        agent_id: { in: teamMembers.map((m) => m.id) },
        ...dateFilter,
      },
      include: {
        users_deals_agent_idTousers: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            profile_photo_url: true,
            commission_level: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    // Calculate manager's overrides from team sales (excluding their own deals)
    // Override = difference between manager's commission level and agent's commission level
    const managerCommissionLevel = currentUser.commission_level || 90;
    const managerOverrides = teamDeals
      .filter((d) => d.agent_id !== session.user.id) // Exclude manager's own deals
      .reduce((sum, d) => {
        const agentCommissionLevel = d.users_deals_agent_idTousers.commission_level || 70;
        const overridePercent = Math.max(0, managerCommissionLevel - agentCommissionLevel);
        const baseCommission = Number(d.base_commission || d.annual_premium);
        return sum + (baseCommission * (overridePercent / 100));
      }, 0);

    // Calculate team stats
    const teamStats = {
      totalPremium: teamDeals.reduce((sum, d) => sum + Number(d.annual_premium), 0),
      totalDeals: teamDeals.length,
      lifeDeals: teamDeals.filter((d) => d.insurance_type === "LIFE").length,
      healthDeals: teamDeals.filter((d) => d.insurance_type === "HEALTH").length,
      lifePremium: teamDeals
        .filter((d) => d.insurance_type === "LIFE")
        .reduce((sum, d) => sum + Number(d.annual_premium), 0),
      healthPremium: teamDeals
        .filter((d) => d.insurance_type === "HEALTH")
        .reduce((sum, d) => sum + Number(d.annual_premium), 0),
      totalCommission: teamDeals.reduce((sum, d) => sum + Number(d.agent_commission || 0), 0),
      avgDealSize: teamDeals.length > 0
        ? teamDeals.reduce((sum, d) => sum + Number(d.annual_premium), 0) / teamDeals.length
        : 0,
      managerOverrides,
      teamDealsCount: teamDeals.filter((d) => d.agent_id !== session.user.id).length,
    };

    // Calculate per-member stats
    const memberStatsMap = new Map<string, {
      deals: number;
      premium: number;
      commission: number;
      lifeDeals: number;
      healthDeals: number;
    }>();

    teamMembers.forEach((member) => {
      memberStatsMap.set(member.id, {
        deals: 0,
        premium: 0,
        commission: 0,
        lifeDeals: 0,
        healthDeals: 0,
      });
    });

    teamDeals.forEach((deal) => {
      const stats = memberStatsMap.get(deal.agent_id);
      if (stats) {
        stats.deals += 1;
        stats.premium += Number(deal.annual_premium);
        stats.commission += Number(deal.agent_commission || 0);
        if (deal.insurance_type === "LIFE") {
          stats.lifeDeals += 1;
        } else {
          stats.healthDeals += 1;
        }
      }
    });

    // Build member list with stats
    const membersWithStats = teamMembers.map((member) => {
      const stats = memberStatsMap.get(member.id) || {
        deals: 0,
        premium: 0,
        commission: 0,
        lifeDeals: 0,
        healthDeals: 0,
      };
      return {
        id: member.id,
        firstName: member.first_name,
        lastName: member.last_name,
        email: member.email,
        role: member.role,
        commissionLevel: member.commission_level,
        profilePhotoUrl: member.profile_photo_url,
        ...stats,
      };
    }).sort((a, b) => b.premium - a.premium); // Sort by premium descending

    // Get recent team deals (top 10)
    const recentDeals = teamDeals.slice(0, 10).map((d) => ({
      id: d.id,
      clientName: d.client_name,
      insuranceType: d.insurance_type,
      annualPremium: Number(d.annual_premium),
      carrierName: d.carrier_name,
      createdAt: d.created_at,
      agent: {
        id: d.users_deals_agent_idTousers.id,
        firstName: d.users_deals_agent_idTousers.first_name,
        lastName: d.users_deals_agent_idTousers.last_name,
        profilePhotoUrl: d.users_deals_agent_idTousers.profile_photo_url,
      },
    }));

    // Calculate goal progress
    const goalProgress = {
      deals: team?.monthly_deal_goal
        ? Math.round((teamStats.totalDeals / team.monthly_deal_goal) * 100)
        : null,
      premium: team?.monthly_premium_goal
        ? Math.round((teamStats.totalPremium / Number(team.monthly_premium_goal)) * 100)
        : null,
    };

    return NextResponse.json({
      team: team ? {
        id: team.id,
        name: team.name,
        emoji: team.emoji,
        color: team.color,
        monthlyDealGoal: team.monthly_deal_goal,
        monthlyPremiumGoal: team.monthly_premium_goal ? Number(team.monthly_premium_goal) : null,
      } : null,
      members: membersWithStats,
      stats: teamStats,
      recentDeals,
      goalProgress,
      memberCount: teamMembers.length,
    });
  } catch (error) {
    console.error("Error fetching team data:", error);
    return NextResponse.json({ message: "Failed to fetch team data" }, { status: 500 });
  }
}
