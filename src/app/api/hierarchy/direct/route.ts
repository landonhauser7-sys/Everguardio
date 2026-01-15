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

// Count all downline recursively
async function countAllDownline(userId: string): Promise<number> {
  const directRecruits = await prisma.users.findMany({
    where: { upline_id: userId, status: "ACTIVE" },
    select: { id: true },
  });

  let total = directRecruits.length;

  for (const recruit of directRecruits) {
    total += await countAllDownline(recruit.id);
  }

  return total;
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

    // Default to current month
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const dateFilter = {
      gte: startDate ? new Date(startDate) : defaultStart,
      lte: endDate ? new Date(endDate) : defaultEnd,
    };

    // Get direct recruits only (one level deep)
    const directRecruits = await prisma.users.findMany({
      where: {
        upline_id: session.user.id,
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
        status: true,
        created_at: true,
      },
      orderBy: { first_name: "asc" },
    });

    // For each direct recruit, get their stats
    const recruitsWithStats = await Promise.all(
      directRecruits.map(async (recruit) => {
        // Get their production
        const deals = await prisma.deals.findMany({
          where: {
            agent_id: recruit.id,
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

        // Count their total downline
        const totalDownline = await countAllDownline(recruit.id);

        // Count direct recruits of this person
        const theirDirectRecruits = await prisma.users.count({
          where: { upline_id: recruit.id, status: "ACTIVE" },
        });

        return {
          id: recruit.id,
          firstName: recruit.first_name,
          lastName: recruit.last_name,
          name: `${recruit.first_name} ${recruit.last_name}`,
          email: recruit.email,
          role: recruit.role,
          roleLabel: getRoleFromLevel(recruit.commission_level),
          commissionLevel: recruit.commission_level,
          profilePhotoUrl: recruit.profile_photo_url,
          status: recruit.status,
          joinedAt: recruit.created_at,
          personalProduction,
          personalDeals: deals.length,
          totalDownline,
          directRecruits: theirDirectRecruits,
          hasDownline: totalDownline > 0,
        };
      })
    );

    // Sort by production descending
    recruitsWithStats.sort((a, b) => b.personalProduction - a.personalProduction);

    return NextResponse.json({
      directRecruits: recruitsWithStats,
      totalDirectRecruits: recruitsWithStats.length,
      dateRange: {
        start: dateFilter.gte,
        end: dateFilter.lte,
      },
    });
  } catch (error) {
    console.error("Error fetching direct recruits:", error);
    return NextResponse.json(
      { message: "Failed to fetch direct recruits" },
      { status: 500 }
    );
  }
}
