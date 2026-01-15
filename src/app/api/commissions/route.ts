import { NextResponse } from "next/server";
import { getServerSession, authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// Commission level constants for 7-level hierarchy
// Each level earns 10% override from the level below
const COMMISSION_LEVELS = {
  PRODIGY: 70,
  BA: 80,
  SA: 90,
  GA: 100,
  MGA: 110,
  PARTNER: 120,
  AO: 130,
};

// Manager levels (anyone who can receive overrides)
const MANAGER_LEVELS = [80, 90, 100, 110, 120]; // BA through Partner
const OWNER_LEVEL = 130;

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Only allow admin access
    if (!["AO", "PARTNER"].includes(session.user.role || "")) {
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

    // Get all deals in date range with full commission data
    const deals = await prisma.deals.findMany({
      where: dateFilter,
      include: {
        users_deals_agent_idTousers: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            profile_photo_url: true,
            commission_level: true,
            manager_id: true,
          },
        },
        users_deals_manager_idTousers: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
        users_deals_owner_idTousers: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
        commission_splits: true,
      },
    });

    // Calculate company totals
    const companyTotals = {
      totalCommissionPool: deals.reduce((sum, d) => sum + Number(d.total_commission_pool || 0), 0),
      agentCommissions: deals.reduce((sum, d) => sum + Number(d.agent_commission || d.commission_amount || 0), 0),
      managerOverrides: deals.reduce((sum, d) => sum + Number(d.manager_override || 0), 0),
      ownerOverrides: deals.reduce((sum, d) => sum + Number(d.owner_override || 0), 0),
      totalPremium: deals.reduce((sum, d) => sum + Number(d.annual_premium), 0),
      totalDeals: deals.length,
    };

    // Build agent breakdown
    const agentMap = new Map<string, {
      id: string;
      name: string;
      profilePhotoUrl: string | null;
      commissionLevel: number;
      personalSales: number;
      personalDeals: number;
      overrideEarned: number;
      totalCommission: number;
    }>();

    // First pass: aggregate personal sales
    deals.forEach(deal => {
      const agent = deal.users_deals_agent_idTousers;
      const agentId = agent.id;

      const existing = agentMap.get(agentId) || {
        id: agentId,
        name: `${agent.first_name} ${agent.last_name}`,
        profilePhotoUrl: agent.profile_photo_url,
        commissionLevel: agent.commission_level || COMMISSION_LEVELS.PRODIGY,
        personalSales: 0,
        personalDeals: 0,
        overrideEarned: 0,
        totalCommission: 0,
      };

      existing.personalSales += Number(deal.agent_commission || deal.commission_amount || 0);
      existing.personalDeals += 1;
      agentMap.set(agentId, existing);
    });

    // Second pass: aggregate overrides from commission_splits
    const allSplits = await prisma.commission_splits.findMany({
      where: {
        is_override: true,
        deals: dateFilter,
      },
    });

    allSplits.forEach(split => {
      const existing = agentMap.get(split.user_id);
      if (existing) {
        existing.overrideEarned += Number(split.commission_amount);
      } else {
        // This person received overrides but didn't sell anything
        agentMap.set(split.user_id, {
          id: split.user_id,
          name: split.user_name,
          profilePhotoUrl: null,
          commissionLevel: split.role_in_hierarchy === "OWNER" ? OWNER_LEVEL : split.commission_level,
          personalSales: 0,
          personalDeals: 0,
          overrideEarned: Number(split.commission_amount),
          totalCommission: Number(split.commission_amount),
        });
      }
    });

    // Calculate totals
    agentMap.forEach(agent => {
      agent.totalCommission = agent.personalSales + agent.overrideEarned;
    });

    const agentBreakdown = Array.from(agentMap.values())
      .sort((a, b) => b.totalCommission - a.totalCommission);

    // Build manager override breakdown
    const managerBreakdown: Array<{
      id: string;
      name: string;
      profilePhotoUrl: string | null;
      teamAgents: number;
      teamDeals: number;
      overrideEarned: number;
      personalSales: number;
    }> = [];

    // Find all managers (BA through Partner - anyone who can receive overrides)
    const managers = await prisma.users.findMany({
      where: {
        commission_level: {
          in: MANAGER_LEVELS,
        },
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        profile_photo_url: true,
        commission_level: true,
      },
    });

    for (const manager of managers) {
      // Get agents under this manager
      const teamAgents = await prisma.users.count({
        where: { manager_id: manager.id },
      });

      // Get deals from team agents
      const teamDeals = deals.filter(d => d.manager_id === manager.id).length;

      // Get override earned
      const managerOverrides = allSplits
        .filter(s => s.user_id === manager.id && s.role_in_hierarchy === "MANAGER")
        .reduce((sum, s) => sum + Number(s.commission_amount), 0);

      // Personal sales
      const personalSales = agentMap.get(manager.id)?.personalSales || 0;

      if (teamAgents > 0 || managerOverrides > 0 || personalSales > 0) {
        managerBreakdown.push({
          id: manager.id,
          name: `${manager.first_name} ${manager.last_name}`,
          profilePhotoUrl: manager.profile_photo_url,
          teamAgents,
          teamDeals,
          overrideEarned: managerOverrides,
          personalSales,
        });
      }
    }

    // Build owner override breakdown
    const ownerBreakdown = {
      fromManagers: 0,
      fromDirectAgents: 0,
      totalOverrides: 0,
    };

    // Get owner splits
    const ownerSplits = allSplits.filter(s => s.role_in_hierarchy === "OWNER");

    for (const split of ownerSplits) {
      // Check if this came from a manager's sale or an agent's sale
      const deal = deals.find(d =>
        d.commission_splits.some(cs => cs.id === split.id)
      );

      if (deal) {
        const agentLevel = deal.users_deals_agent_idTousers.commission_level || COMMISSION_LEVELS.PRODIGY;
        // If agent is BA or above, count as "from managers", otherwise "from agents"
        if (agentLevel >= COMMISSION_LEVELS.BA) {
          ownerBreakdown.fromManagers += Number(split.commission_amount);
        } else {
          ownerBreakdown.fromDirectAgents += Number(split.commission_amount);
        }
      }
    }

    ownerBreakdown.totalOverrides = ownerBreakdown.fromManagers + ownerBreakdown.fromDirectAgents;

    return NextResponse.json({
      companyTotals,
      agentBreakdown,
      managerBreakdown: managerBreakdown.sort((a, b) => b.overrideEarned - a.overrideEarned),
      ownerBreakdown,
      dateRange: {
        start: dateFilter.created_at.gte,
        end: dateFilter.created_at.lte,
      },
    });
  } catch (error) {
    console.error("Commission report error:", error);
    return NextResponse.json({ message: "Failed to fetch commission report" }, { status: 500 });
  }
}
