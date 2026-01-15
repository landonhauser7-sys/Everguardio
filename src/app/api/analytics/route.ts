import { NextResponse } from "next/server";
import { getServerSession, authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// Team colors for consistency
const TEAM_COLORS = ["#EF4444", "#A855F7", "#06B6D4", "#F59E0B", "#22C55E", "#3B82F6", "#EC4899", "#14B8A6"];

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!["AO", "PARTNER"].includes(session.user.role || "")) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const insuranceTypeFilter = searchParams.get("insuranceType"); // "LIFE", "HEALTH", or null for both

    const dateFilter = {
      created_at: {
        gte: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        lte: endDate ? new Date(endDate) : new Date(),
      },
    };

    // Build deals filter
    const dealsFilter: Record<string, unknown> = { ...dateFilter };
    if (insuranceTypeFilter && (insuranceTypeFilter === "LIFE" || insuranceTypeFilter === "HEALTH")) {
      dealsFilter.insurance_type = insuranceTypeFilter;
    }

    // Get all deals for the period
    const deals = await prisma.deals.findMany({
      where: dealsFilter,
      include: {
        users_deals_agent_idTousers: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
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

    // Calculate stats
    const totalPremium = deals.reduce((sum, d) => sum + Number(d.annual_premium), 0);
    const lifePremium = deals
      .filter((d) => d.insurance_type === "LIFE")
      .reduce((sum, d) => sum + Number(d.annual_premium), 0);
    const healthPremium = deals
      .filter((d) => d.insurance_type === "HEALTH")
      .reduce((sum, d) => sum + Number(d.annual_premium), 0);
    const lifeDeals = deals.filter((d) => d.insurance_type === "LIFE").length;
    const healthDeals = deals.filter((d) => d.insurance_type === "HEALTH").length;
    const totalDeals = deals.length;
    const avgDealSize = totalDeals > 0 ? totalPremium / totalDeals : 0;

    // Calculate commission breakdown (70/110/130 structure)
    const totalCommissionPool = deals.reduce((sum, d) => sum + Number(d.total_commission_pool || 0), 0);
    const agentCommissions = deals.reduce((sum, d) => sum + Number(d.agent_commission || 0), 0);
    const managerOverrides = deals.reduce((sum, d) => sum + Number(d.manager_override || 0), 0);
    const ownerOverrides = deals.reduce((sum, d) => sum + Number(d.owner_override || 0), 0);

    // Get unique agents with production
    const activeAgentIds = new Set(deals.map((d) => d.agent_id));
    const activeAgents = activeAgentIds.size;

    // Daily production data
    const dailyMap = new Map<string, { date: string; life: number; health: number }>();
    const startDateObj = dateFilter.created_at.gte;
    const endDateObj = dateFilter.created_at.lte;
    const daysDiff = Math.ceil(
      (endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Initialize all days
    for (let i = 0; i <= daysDiff; i++) {
      const date = new Date(startDateObj);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];
      dailyMap.set(dateStr, { date: dateStr, life: 0, health: 0 });
    }

    // Aggregate deals by date
    deals.forEach((deal) => {
      const dateStr = new Date(deal.created_at).toISOString().split("T")[0];
      const existing = dailyMap.get(dateStr);
      if (existing) {
        if (deal.insurance_type === "LIFE") {
          existing.life += Number(deal.annual_premium);
        } else {
          existing.health += Number(deal.annual_premium);
        }
      }
    });

    const dailyProduction = Array.from(dailyMap.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Premium by carrier
    const carrierMap = new Map<string, { carrier: string; premium: number; deals: number }>();
    deals.forEach((deal) => {
      const existing = carrierMap.get(deal.carrier_name) || {
        carrier: deal.carrier_name,
        premium: 0,
        deals: 0,
      };
      existing.premium += Number(deal.annual_premium);
      existing.deals += 1;
      carrierMap.set(deal.carrier_name, existing);
    });

    const premiumByCarrier = Array.from(carrierMap.values())
      .sort((a, b) => b.premium - a.premium)
      .slice(0, 10);

    // Calculate percentages for carrier chart
    const carrierWithPercentage = premiumByCarrier.map((c) => ({
      ...c,
      percentage: totalPremium > 0 ? (c.premium / totalPremium) * 100 : 0,
    }));

    // ============================================
    // TEAM PERFORMANCE DATA
    // ============================================

    // Get all teams
    const teams = await prisma.teams.findMany({
      select: {
        id: true,
        name: true,
        emoji: true,
        color: true,
      },
      orderBy: { name: "asc" },
    });

    // Team daily performance data
    type TeamDailyData = { [teamId: string]: number };
    const teamDailyMap = new Map<string, TeamDailyData>();

    // Initialize all days for team data
    for (let i = 0; i <= daysDiff; i++) {
      const date = new Date(startDateObj);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];
      const teamData: TeamDailyData = {};
      teams.forEach((team) => {
        teamData[team.id] = 0;
      });
      teamDailyMap.set(dateStr, teamData);
    }

    // Aggregate deals by team and date
    deals.forEach((deal) => {
      const agent = deal.users_deals_agent_idTousers;
      const teamId = agent.team_id;
      if (teamId) {
        const dateStr = new Date(deal.created_at).toISOString().split("T")[0];
        const existing = teamDailyMap.get(dateStr);
        if (existing && existing[teamId] !== undefined) {
          existing[teamId] += Number(deal.annual_premium);
        }
      }
    });

    // Convert to array format for chart
    const teamDailyProduction = Array.from(teamDailyMap.entries())
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([date, teamData]) => ({
        date,
        ...teamData,
      }));

    // Team summary stats
    const teamStatsMap = new Map<
      string,
      {
        teamId: string;
        teamName: string;
        teamEmoji: string | null;
        teamColor: string | null;
        totalDeals: number;
        lifeDeals: number;
        healthDeals: number;
        totalPremium: number;
        agentIds: Set<string>;
      }
    >();

    // Initialize team stats
    teams.forEach((team) => {
      teamStatsMap.set(team.id, {
        teamId: team.id,
        teamName: team.name,
        teamEmoji: team.emoji,
        teamColor: team.color,
        totalDeals: 0,
        lifeDeals: 0,
        healthDeals: 0,
        totalPremium: 0,
        agentIds: new Set(),
      });
    });

    // Aggregate team stats
    deals.forEach((deal) => {
      const agent = deal.users_deals_agent_idTousers;
      const teamId = agent.team_id;
      if (teamId) {
        const existing = teamStatsMap.get(teamId);
        if (existing) {
          existing.totalDeals += 1;
          existing.totalPremium += Number(deal.annual_premium);
          existing.agentIds.add(agent.id);
          if (deal.insurance_type === "LIFE") {
            existing.lifeDeals += 1;
          } else {
            existing.healthDeals += 1;
          }
        }
      }
    });

    // Convert to array and sort by premium
    const teamStats = Array.from(teamStatsMap.values())
      .map((team, index) => ({
        rank: 0, // Will be set after sorting
        teamId: team.teamId,
        teamName: team.teamName,
        teamEmoji: team.teamEmoji,
        teamColor: team.teamColor || TEAM_COLORS[index % TEAM_COLORS.length],
        totalDeals: team.totalDeals,
        lifeDeals: team.lifeDeals,
        healthDeals: team.healthDeals,
        totalPremium: team.totalPremium,
        agentCount: team.agentIds.size,
        avgPerAgent: team.agentIds.size > 0 ? team.totalPremium / team.agentIds.size : 0,
      }))
      .filter((team) => team.totalDeals > 0 || teams.length <= 4) // Show teams with deals or if few teams
      .sort((a, b) => b.totalPremium - a.totalPremium)
      .map((team, index) => ({ ...team, rank: index + 1 }));

    // Team chart config
    const teamChartConfig = teams.map((team, index) => ({
      id: team.id,
      name: team.name,
      emoji: team.emoji,
      color: team.color || TEAM_COLORS[index % TEAM_COLORS.length],
    }));

    // Check if we have real team data
    const hasRealTeamData = teams.length > 0 && deals.some((d) => d.users_deals_agent_idTousers.team_id);

    return NextResponse.json({
      stats: {
        totalPremium,
        lifePremium,
        healthPremium,
        lifeDeals,
        healthDeals,
        totalDeals,
        avgDealSize,
        activeAgents,
      },
      commissionBreakdown: {
        totalPool: totalCommissionPool,
        agentCommissions,
        managerOverrides,
        ownerOverrides,
      },
      dailyProduction,
      premiumByCarrier: carrierWithPercentage,
      lifeVsHealth: {
        life: { premium: lifePremium, deals: lifeDeals, percentage: totalPremium > 0 ? (lifePremium / totalPremium) * 100 : 0 },
        health: { premium: healthPremium, deals: healthDeals, percentage: totalPremium > 0 ? (healthPremium / totalPremium) * 100 : 0 },
      },
      teamPerformance: {
        hasRealData: hasRealTeamData,
        teams: teamChartConfig,
        dailyData: teamDailyProduction,
        stats: teamStats,
      },
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json({ message: "Failed to fetch analytics" }, { status: 500 });
  }
}
