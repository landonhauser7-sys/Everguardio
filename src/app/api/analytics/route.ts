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

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
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

    // Get all deals for the period
    const deals = await prisma.deals.findMany({
      where: dateFilter,
      include: {
        users_deals_agent_idTousers: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
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
      dailyProduction,
      premiumByCarrier: carrierWithPercentage,
      lifeVsHealth: {
        life: { premium: lifePremium, deals: lifeDeals, percentage: totalPremium > 0 ? (lifePremium / totalPremium) * 100 : 0 },
        health: { premium: healthPremium, deals: healthDeals, percentage: totalPremium > 0 ? (healthPremium / totalPremium) * 100 : 0 },
      },
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json({ message: "Failed to fetch analytics" }, { status: 500 });
  }
}
