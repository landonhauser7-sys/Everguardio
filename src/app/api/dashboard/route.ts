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

    const userId = session.user.id;
    const userRole = session.user.role;

    // Get personal stats
    const personalDeals = await prisma.deals.findMany({
      where: {
        agent_id: userId,
        ...dateFilter,
      },
    });

    const personalStats = {
      premium: personalDeals.reduce((sum, d) => sum + Number(d.annual_premium), 0),
      commission: personalDeals.reduce((sum, d) => sum + Number(d.commission_amount), 0),
      deals: personalDeals.length,
      lifeDeals: personalDeals.filter(d => d.insurance_type === "LIFE").length,
      healthDeals: personalDeals.filter(d => d.insurance_type === "HEALTH").length,
      lifePremium: personalDeals.filter(d => d.insurance_type === "LIFE").reduce((sum, d) => sum + Number(d.annual_premium), 0),
      healthPremium: personalDeals.filter(d => d.insurance_type === "HEALTH").reduce((sum, d) => sum + Number(d.annual_premium), 0),
    };

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
    if (userRole === "ADMIN") {
      agency = {
        premium: allDeals.reduce((sum, d) => sum + Number(d.annual_premium), 0),
        commission: allDeals.reduce((sum, d) => sum + Number(d.commission_amount), 0),
        deals: allDeals.length,
        activeAgents: performerMap.size,
        lifeDeals: allDeals.filter(d => d.insurance_type === "LIFE").length,
        healthDeals: allDeals.filter(d => d.insurance_type === "HEALTH").length,
        lifePremium: allDeals.filter(d => d.insurance_type === "LIFE").reduce((sum, d) => sum + Number(d.annual_premium), 0),
        healthPremium: allDeals.filter(d => d.insurance_type === "HEALTH").reduce((sum, d) => sum + Number(d.annual_premium), 0),
      };
    }

    // Production chart data - daily breakdown for last 30 days
    const chartDeals = userRole === "ADMIN" ? allDeals : personalDeals;
    const chartDataMap = new Map<string, { date: string; life: number; health: number }>();

    // Initialize all days in the range
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
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
