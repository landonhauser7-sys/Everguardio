import { NextResponse } from "next/server";
import { getServerSession, authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  getWeekStart,
  getWeekEnd,
  parseDateLocal,
  formatDateForDB,
  formatWeekRange,
} from "@/lib/payout-utils";

interface AgentBreakdown {
  agentId: string;
  agentName: string;
  level: string;
  deals: number;
  production: number;
  theirCommission: number;
  yourOverride: number;
  isExpanded?: boolean;
  directReports?: AgentBreakdown[];
}

// Get all downline user IDs recursively
async function getAllDownlineIds(userId: string): Promise<string[]> {
  const directRecruits = await prisma.users.findMany({
    where: { upline_id: userId, status: "ACTIVE" },
    select: { id: true },
  });

  const allIds: string[] = directRecruits.map((r) => r.id);

  for (const recruit of directRecruits) {
    const subDownline = await getAllDownlineIds(recruit.id);
    allIds.push(...subDownline);
  }

  return allIds;
}

// Get direct reports for a user
async function getDirectReports(userId: string): Promise<Array<{
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  commission_level: number;
}>> {
  return prisma.users.findMany({
    where: { upline_id: userId, status: "ACTIVE" },
    select: {
      id: true,
      first_name: true,
      last_name: true,
      role: true,
      commission_level: true,
    },
    orderBy: { first_name: "asc" },
  });
}

// GET - Fetch team payouts for a leader
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const weekStartParam = searchParams.get("week_start");
    const userId = searchParams.get("user_id") || session.user.id;

    // Only allow viewing own team (or downline for higher managers - TODO)
    if (userId !== session.user.id) {
      return NextResponse.json({ message: "Access denied" }, { status: 403 });
    }

    // Calculate week bounds
    let weekStart: Date;
    if (weekStartParam) {
      weekStart = parseDateLocal(weekStartParam);
    } else {
      weekStart = getWeekStart(new Date());
    }
    const weekEnd = getWeekEnd(weekStart);

    // Get user info
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        role: true,
        commission_level: true,
        is_manager: true,
      },
    });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // Check if user is a manager
    if (!user.is_manager && (user.commission_level || 70) < 80) {
      return NextResponse.json({ message: "Not a manager" }, { status: 403 });
    }

    // Get all downline IDs
    const downlineIds = await getAllDownlineIds(userId);

    if (downlineIds.length === 0) {
      return NextResponse.json({
        userId: user.id,
        userName: `${user.first_name} ${user.last_name}`,
        userLevel: user.role,
        weekStart: formatDateForDB(weekStart),
        weekEnd: formatDateForDB(weekEnd),
        weekDisplay: formatWeekRange(weekStart, weekEnd),
        teamTotals: {
          totalProduction: 0,
          totalDeals: 0,
          totalCommissions: 0,
          yourOverride: 0,
        },
        agentBreakdown: [],
      });
    }

    // Fetch all deals from downline depositing this week
    const downlineDeals = await prisma.deals.findMany({
      where: {
        agent_id: { in: downlineIds },
        deposit_date: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      include: {
        users_deals_agent_idTousers: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            role: true,
            commission_level: true,
            upline_id: true,
          },
        },
        payouts: {
          where: {
            user_id: userId,
            type: "OVERRIDE",
          },
        },
      },
    });

    // Get direct reports
    const directReports = await getDirectReports(userId);

    // Build agent breakdown
    const agentMap = new Map<string, AgentBreakdown>();

    // Initialize all direct reports
    for (const report of directReports) {
      agentMap.set(report.id, {
        agentId: report.id,
        agentName: `${report.first_name} ${report.last_name}`,
        level: report.role,
        deals: 0,
        production: 0,
        theirCommission: 0,
        yourOverride: 0,
        directReports: [],
      });
    }

    // Process deals
    let totalProduction = 0;
    let totalDeals = 0;
    let totalCommissions = 0;
    let yourOverride = 0;

    for (const deal of downlineDeals) {
      const agent = deal.users_deals_agent_idTousers;
      const premium = Number(deal.annual_premium);
      const agentCommission = Number(deal.agent_commission || deal.commission_amount);
      const myOverrideFromDeal = deal.payouts.reduce((sum, p) => sum + Number(p.amount), 0);

      totalProduction += premium;
      totalDeals++;
      totalCommissions += agentCommission;
      yourOverride += myOverrideFromDeal;

      // Find which direct report this agent belongs to
      let targetId = agent.id;
      let currentUplineId = agent.upline_id;

      // Walk up the tree to find the direct report
      while (currentUplineId && currentUplineId !== userId) {
        const parent = await prisma.users.findUnique({
          where: { id: currentUplineId },
          select: { id: true, upline_id: true },
        });
        if (parent) {
          targetId = parent.id;
          currentUplineId = parent.upline_id;
        } else {
          break;
        }
      }

      // If the target is a direct report, add to their totals
      if (agentMap.has(targetId)) {
        const entry = agentMap.get(targetId)!;
        entry.deals++;
        entry.production += premium;
        entry.theirCommission += agentCommission;
        entry.yourOverride += myOverrideFromDeal;
      } else if (agent.upline_id === userId) {
        // Agent is a direct report not yet in the map
        if (!agentMap.has(agent.id)) {
          agentMap.set(agent.id, {
            agentId: agent.id,
            agentName: `${agent.first_name} ${agent.last_name}`,
            level: agent.role,
            deals: 1,
            production: premium,
            theirCommission: agentCommission,
            yourOverride: myOverrideFromDeal,
          });
        }
      }
    }

    // Convert map to array and sort
    const agentBreakdown = Array.from(agentMap.values())
      .filter(a => a.deals > 0 || a.production > 0)
      .sort((a, b) => b.production - a.production);

    return NextResponse.json({
      userId: user.id,
      userName: `${user.first_name} ${user.last_name}`,
      userLevel: user.role,
      weekStart: formatDateForDB(weekStart),
      weekEnd: formatDateForDB(weekEnd),
      weekDisplay: formatWeekRange(weekStart, weekEnd),
      teamTotals: {
        totalProduction,
        totalDeals,
        totalCommissions,
        yourOverride,
      },
      agentBreakdown,
    });
  } catch (error) {
    console.error("Error fetching team payouts:", error);
    return NextResponse.json({ message: "Failed to fetch team payouts" }, { status: 500 });
  }
}
