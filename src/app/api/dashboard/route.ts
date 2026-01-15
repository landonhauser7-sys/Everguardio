import { NextResponse } from "next/server";
import { getServerSession, authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// Commission level constants
const AGENT_LEVEL = 70;
const MANAGER_LEVEL = 110;
const OWNER_LEVEL = 130;

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

    const userId = session.user.id;
    const userRole = session.user.role;

    // Get current user's commission level
    const currentUser = await prisma.users.findUnique({
      where: { id: userId },
      select: { commission_level: true },
    });
    const commissionLevel = currentUser?.commission_level || AGENT_LEVEL;

    // Get personal deals (deals where agent_id = userId)
    const personalDeals = await prisma.deals.findMany({
      where: {
        agent_id: userId,
        ...dateFilter,
      },
    });

    // Calculate personal stats
    const personalStats = {
      premium: personalDeals.reduce((sum, d) => sum + Number(d.annual_premium), 0),
      commission: personalDeals.reduce((sum, d) => sum + Number(d.agent_commission || d.commission_amount), 0),
      deals: personalDeals.length,
      lifeDeals: personalDeals.filter(d => d.insurance_type === "LIFE").length,
      healthDeals: personalDeals.filter(d => d.insurance_type === "HEALTH").length,
      lifePremium: personalDeals.filter(d => d.insurance_type === "LIFE").reduce((sum, d) => sum + Number(d.annual_premium), 0),
      healthPremium: personalDeals.filter(d => d.insurance_type === "HEALTH").reduce((sum, d) => sum + Number(d.annual_premium), 0),
    };

    // Initialize commission breakdown
    let commissionBreakdown = {
      personalSales: personalStats.commission,
      teamOverrides: 0,
      agentOverrides: 0,
      managerOverrides: 0,
      total: personalStats.commission,
      commissionLevel,
    };

    // Get commission splits for this user (overrides they receive)
    const userCommissionSplits = await prisma.commission_splits.findMany({
      where: {
        user_id: userId,
        is_override: true,
        deals: {
          ...dateFilter,
        },
      },
      include: {
        deals: {
          select: {
            agent_id: true,
            users_deals_agent_idTousers: {
              select: {
                first_name: true,
                last_name: true,
                commission_level: true,
              },
            },
          },
        },
      },
    });

    // Calculate override income based on commission level
    if (commissionLevel === MANAGER_LEVEL) {
      // Manager: show team overrides (40% from agents under them)
      const teamOverrides = userCommissionSplits
        .filter(s => s.role_in_hierarchy === "MANAGER")
        .reduce((sum, s) => sum + Number(s.commission_amount), 0);

      commissionBreakdown.teamOverrides = teamOverrides;
      commissionBreakdown.total = personalStats.commission + teamOverrides;
    } else if (commissionLevel === OWNER_LEVEL || ["AO", "PARTNER"].includes(userRole || "")) {
      // Owner/Admin: show agent overrides and manager overrides separately
      const ownerSplits = userCommissionSplits.filter(s => s.role_in_hierarchy === "OWNER");

      // Separate overrides from agents with managers vs direct agents
      let agentOverrides = 0;
      let managerOverrides = 0;

      for (const split of ownerSplits) {
        const agentLevel = split.deals.users_deals_agent_idTousers.commission_level || AGENT_LEVEL;
        if (agentLevel === AGENT_LEVEL) {
          // This came from an agent with a manager (20% spread)
          if (split.commission_level === 20) {
            agentOverrides += Number(split.commission_amount);
          } else {
            // No manager, owner gets full 60% spread
            agentOverrides += Number(split.commission_amount);
          }
        } else if (agentLevel === MANAGER_LEVEL) {
          // This came from a manager's personal sale (20% spread)
          managerOverrides += Number(split.commission_amount);
        }
      }

      commissionBreakdown.agentOverrides = agentOverrides;
      commissionBreakdown.managerOverrides = managerOverrides;
      commissionBreakdown.total = personalStats.commission + agentOverrides + managerOverrides;
    }

    // Get recent deals for activity feed
    const recentDeals = await prisma.deals.findMany({
      where: dateFilter,
      orderBy: { created_at: "desc" },
      take: 10,
      include: {
        users_deals_agent_idTousers: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            profile_photo_url: true,
          },
        },
      },
    });

    // Get top performers
    const allDeals = await prisma.deals.findMany({
      where: dateFilter,
      include: {
        users_deals_agent_idTousers: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            profile_photo_url: true,
          },
        },
      },
    });

    const performerMap = new Map<string, { name: string; premium: number; deals: number; profilePhotoUrl: string | null }>();
    allDeals.forEach(deal => {
      const agent = deal.users_deals_agent_idTousers;
      const existing = performerMap.get(agent.id) || {
        name: `${agent.first_name} ${agent.last_name}`,
        premium: 0,
        deals: 0,
        profilePhotoUrl: agent.profile_photo_url,
      };
      existing.premium += Number(deal.annual_premium);
      existing.deals += 1;
      performerMap.set(agent.id, existing);
    });

    const topPerformers = Array.from(performerMap.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.premium - a.premium)
      .slice(0, 5);

    // Calculate rank
    const sortedPerformers = Array.from(performerMap.entries())
      .sort((a, b) => b[1].premium - a[1].premium);
    const rank = sortedPerformers.findIndex(([id]) => id === userId) + 1;

    // Agency stats for admin
    let agency = null;
    if (["AO", "PARTNER"].includes(userRole || "")) {
      const totalCommissionPool = allDeals.reduce((sum, d) => sum + Number(d.total_commission_pool || 0), 0);
      const agentCommissions = allDeals.reduce((sum, d) => sum + Number(d.agent_commission || d.commission_amount), 0);
      const managerOverrides = allDeals.reduce((sum, d) => sum + Number(d.manager_override || 0), 0);
      const ownerOverrides = allDeals.reduce((sum, d) => sum + Number(d.owner_override || 0), 0);

      agency = {
        premium: allDeals.reduce((sum, d) => sum + Number(d.annual_premium), 0),
        commission: totalCommissionPool,
        agentCommissions,
        managerOverrides,
        ownerOverrides,
        deals: allDeals.length,
        activeAgents: performerMap.size,
        lifeDeals: allDeals.filter(d => d.insurance_type === "LIFE").length,
        healthDeals: allDeals.filter(d => d.insurance_type === "HEALTH").length,
        lifePremium: allDeals.filter(d => d.insurance_type === "LIFE").reduce((sum, d) => sum + Number(d.annual_premium), 0),
        healthPremium: allDeals.filter(d => d.insurance_type === "HEALTH").reduce((sum, d) => sum + Number(d.annual_premium), 0),
      };
    }

    // Production chart data - daily breakdown for selected date range
    const chartDeals = ["AO", "PARTNER"].includes(userRole || "") ? allDeals : personalDeals;
    const chartDataMap = new Map<string, { date: string; life: number; health: number }>();

    // Initialize all days in the selected range
    const rangeStart = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rangeEnd = endDate ? new Date(endDate) : new Date();

    // Calculate number of days in range
    const daysDiff = Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24));

    for (let i = 0; i <= daysDiff; i++) {
      const date = new Date(rangeStart);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      chartDataMap.set(dateStr, { date: dateStr, life: 0, health: 0 });
    }

    // Aggregate deals by date
    chartDeals.forEach(deal => {
      const dateStr = new Date(deal.created_at).toISOString().split('T')[0];
      const existing = chartDataMap.get(dateStr);
      if (existing) {
        if (deal.insurance_type === "LIFE") {
          existing.life += Number(deal.annual_premium);
        } else if (deal.insurance_type === "HEALTH") {
          existing.health += Number(deal.annual_premium);
        }
      }
    });

    const productionChartData = Array.from(chartDataMap.values());

    return NextResponse.json({
      personal: personalStats,
      commissionBreakdown,
      recentDeals: recentDeals.map(d => ({
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
      })),
      topPerformers,
      rank: rank > 0 ? rank : null,
      totalAgents: performerMap.size,
      agency,
      role: userRole,
      productionChartData,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json({ message: "Failed to fetch dashboard" }, { status: 500 });
  }
}
