import { NextResponse } from "next/server";
import { getServerSession, authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole, Prisma } from "@prisma/client";

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

// Get path from user back to the searching user
async function getUplinePath(
  userId: string,
  targetUplineId: string
): Promise<Array<{ id: string; name: string }>> {
  const path: Array<{ id: string; name: string }> = [];
  let currentId: string | null = userId;

  while (currentId && currentId !== targetUplineId) {
    const user: {
      id: string;
      first_name: string;
      last_name: string;
      upline_id: string | null;
    } | null = await prisma.users.findUnique({
      where: { id: currentId },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        upline_id: true,
      },
    });

    if (!user) break;

    path.unshift({ id: user.id, name: `${user.first_name} ${user.last_name}` });
    currentId = user.upline_id;
  }

  return path;
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query")?.toLowerCase() || "";
    const level = searchParams.get("level"); // Filter by role/level
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!query && !level) {
      return NextResponse.json(
        { message: "Search query or level filter required" },
        { status: 400 }
      );
    }

    // Default to current month for production stats
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const dateFilter = {
      gte: startDate ? new Date(startDate) : defaultStart,
      lte: endDate ? new Date(endDate) : defaultEnd,
    };

    // Get all users in the downline
    const allDownlineIds = await getAllDownlineIds(session.user.id);

    if (allDownlineIds.length === 0) {
      return NextResponse.json({ results: [], total: 0 });
    }

    // Build where clause
    const whereClause: Prisma.usersWhereInput = {
      id: { in: allDownlineIds },
      status: "ACTIVE",
    };

    // Add name/email search
    if (query) {
      whereClause.OR = [
        { first_name: { contains: query, mode: "insensitive" } },
        { last_name: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
      ];
    }

    // Add level filter
    if (level) {
      whereClause.role = level as UserRole;
    }

    // Search within downline
    const matchingUsers = await prisma.users.findMany({
      where: whereClause,
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
        upline_id: true,
      },
      take: 50, // Limit results
      orderBy: { first_name: "asc" },
    });

    // Enrich with stats and path info
    const results = await Promise.all(
      matchingUsers.map(async (user) => {
        // Get personal production
        const deals = await prisma.deals.findMany({
          where: {
            agent_id: user.id,
            created_at: {
              gte: dateFilter.gte,
              lte: dateFilter.lte,
            },
          },
          select: { annual_premium: true },
        });

        const personalProduction = deals.reduce(
          (sum, d) => sum + Number(d.annual_premium),
          0
        );

        // Get path from this user to the searching user
        const path = await getUplinePath(user.id, session.user.id);
        const depth = path.length;

        // Get direct upline name
        let directUpline = null;
        if (user.upline_id) {
          const uplineUser = await prisma.users.findUnique({
            where: { id: user.upline_id },
            select: { first_name: true, last_name: true },
          });
          if (uplineUser) {
            directUpline = `${uplineUser.first_name} ${uplineUser.last_name}`;
          }
        }

        // Calculate override you earn from this person
        const searcherLevel = session.user.commissionLevel || 70;
        const overridePercent = Math.min(
          searcherLevel - user.commission_level,
          10 * depth // Max 10% per level
        );
        const overrideEarned = personalProduction * (overridePercent / 100);

        return {
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          name: `${user.first_name} ${user.last_name}`,
          email: user.email,
          role: user.role,
          roleLabel: getRoleFromLevel(user.commission_level),
          commissionLevel: user.commission_level,
          profilePhotoUrl: user.profile_photo_url,
          joinedAt: user.created_at,
          personalProduction,
          personalDeals: deals.length,
          depth,
          directUpline,
          path,
          overridePercent: Math.max(0, overridePercent),
          overrideEarned: Math.max(0, overrideEarned),
        };
      })
    );

    // Sort by production descending
    results.sort((a, b) => b.personalProduction - a.personalProduction);

    return NextResponse.json({
      results,
      total: results.length,
      query,
      dateRange: {
        start: dateFilter.gte,
        end: dateFilter.lte,
      },
    });
  } catch (error) {
    console.error("Error searching hierarchy:", error);
    return NextResponse.json(
      { message: "Failed to search hierarchy" },
      { status: 500 }
    );
  }
}
