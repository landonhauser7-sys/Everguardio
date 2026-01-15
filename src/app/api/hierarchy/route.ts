import { NextResponse } from "next/server";
import { getServerSession, authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

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

interface HierarchyNode {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    name: string;
    email: string;
    role: string;
    commissionLevel: number;
    profilePhotoUrl: string | null;
    status: string;
    createdAt: Date;
  };
  stats: {
    totalDownline: number;
    byLevel: Record<string, number>;
    personalProduction: number;
    personalDeals: number;
  };
  directRecruits: HierarchyNode[];
}

// Recursive function to build the hierarchy tree
async function buildHierarchyTree(
  userId: string,
  dateFilter: { gte: Date; lte: Date },
  depth: number = 0,
  maxDepth: number = 10
): Promise<HierarchyNode | null> {
  if (depth > maxDepth) return null;

  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: {
      id: true,
      first_name: true,
      last_name: true,
      email: true,
      role: true,
      commission_level: true,
      profile_photo_url: true,
      status: true,
      created_at: true,
    },
  });

  if (!user) return null;

  // Get direct recruits (users whose upline_id is this user)
  const directRecruits = await prisma.users.findMany({
    where: {
      upline_id: userId,
      status: "ACTIVE",
    },
    select: {
      id: true,
    },
    orderBy: { first_name: "asc" },
  });

  // Get this user's personal production
  const userDeals = await prisma.deals.findMany({
    where: {
      agent_id: userId,
      created_at: {
        gte: dateFilter.gte,
        lte: dateFilter.lte,
      },
    },
    select: {
      annual_premium: true,
    },
  });

  const personalProduction = userDeals.reduce(
    (sum, d) => sum + Number(d.annual_premium),
    0
  );

  // Recursively build trees for direct recruits
  const recruitTrees: HierarchyNode[] = [];
  for (const recruit of directRecruits) {
    const tree = await buildHierarchyTree(
      recruit.id,
      dateFilter,
      depth + 1,
      maxDepth
    );
    if (tree) {
      recruitTrees.push(tree);
    }
  }

  // Calculate total downline stats by aggregating from recruit trees
  let totalDownline = directRecruits.length;
  const byLevel: Record<string, number> = {};

  for (const tree of recruitTrees) {
    totalDownline += tree.stats.totalDownline;

    // Count this recruit's level
    const recruitLevel = getRoleFromLevel(tree.user.commissionLevel);
    byLevel[recruitLevel] = (byLevel[recruitLevel] || 0) + 1;

    // Add their downline level counts
    for (const [level, count] of Object.entries(tree.stats.byLevel)) {
      byLevel[level] = (byLevel[level] || 0) + count;
    }
  }

  return {
    user: {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      name: `${user.first_name} ${user.last_name}`,
      email: user.email,
      role: user.role,
      commissionLevel: user.commission_level,
      profilePhotoUrl: user.profile_photo_url,
      status: user.status,
      createdAt: user.created_at,
    },
    stats: {
      totalDownline,
      byLevel,
      personalProduction,
      personalDeals: userDeals.length,
    },
    directRecruits: recruitTrees,
  };
}

// Get all downline users as a flat list (for stats calculation)
async function getAllDownlineFlat(userId: string): Promise<string[]> {
  const directRecruits = await prisma.users.findMany({
    where: { upline_id: userId, status: "ACTIVE" },
    select: { id: true },
  });

  const allIds: string[] = directRecruits.map((r) => r.id);

  for (const recruit of directRecruits) {
    const subDownline = await getAllDownlineFlat(recruit.id);
    allIds.push(...subDownline);
  }

  return allIds;
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
    const maxDepth = parseInt(searchParams.get("depth") || "10");
    const includeStats = searchParams.get("includeStats") !== "false";

    // Default to current month
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const dateFilter = {
      gte: startDate ? new Date(startDate) : defaultStart,
      lte: endDate ? new Date(endDate) : defaultEnd,
    };

    // Build the hierarchy tree starting from current user
    const hierarchy = await buildHierarchyTree(
      session.user.id,
      dateFilter,
      0,
      maxDepth
    );

    if (!hierarchy) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // Calculate additional stats if requested
    if (includeStats) {
      const allDownlineIds = await getAllDownlineFlat(session.user.id);

      // Get total team production
      const teamDeals = await prisma.deals.findMany({
        where: {
          agent_id: { in: allDownlineIds },
          created_at: {
            gte: dateFilter.gte,
            lte: dateFilter.lte,
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

      const totalTeamProduction = teamDeals.reduce(
        (sum, d) => sum + Number(d.annual_premium),
        0
      );

      // Calculate override earned
      const currentUser = await prisma.users.findUnique({
        where: { id: session.user.id },
        select: { commission_level: true },
      });

      let totalOverrideEarned = 0;
      if (currentUser) {
        // For each deal in the team, calculate override based on commission level difference
        for (const deal of teamDeals) {
          const agentLevel = deal.users_deals_agent_idTousers.commission_level;
          // Override = (my level - agent's level) * premium / 100
          // But we only get override from the person directly below us in the chain
          // This simplified calc assumes direct relationship
          const overridePercent = Math.min(10, currentUser.commission_level - agentLevel);
          if (overridePercent > 0) {
            totalOverrideEarned += Number(deal.annual_premium) * (overridePercent / 100);
          }
        }
      }

      return NextResponse.json({
        hierarchy,
        summaryStats: {
          totalDownline: hierarchy.stats.totalDownline,
          byLevel: hierarchy.stats.byLevel,
          totalTeamProduction,
          totalTeamDeals: teamDeals.length,
          totalOverrideEarned,
          personalProduction: hierarchy.stats.personalProduction,
          personalDeals: hierarchy.stats.personalDeals,
        },
        dateRange: {
          start: dateFilter.gte,
          end: dateFilter.lte,
        },
      });
    }

    return NextResponse.json({
      hierarchy,
      dateRange: {
        start: dateFilter.gte,
        end: dateFilter.lte,
      },
    });
  } catch (error) {
    console.error("Error fetching hierarchy:", error);
    return NextResponse.json(
      { message: "Failed to fetch hierarchy" },
      { status: 500 }
    );
  }
}
