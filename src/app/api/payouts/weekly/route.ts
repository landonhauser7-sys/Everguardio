import { NextResponse } from "next/server";
import { getServerSession, authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  getWeekStart,
  getWeekEnd,
  parseDateLocal,
  formatDateForDB,
  getDayName,
  getWeekDates,
  isSameDay,
  formatWeekRange,
} from "@/lib/payout-utils";

interface DailyBreakdown {
  [key: string]: {
    date: string;
    amount: number;
  };
}

interface PayoutDeal {
  dealId: string;
  clientName: string;
  effectiveDate: string | null;
  depositDate: string;
  premium: number;
  yourEarnings: number;
  type: "personal" | "override";
  agent: string;
  agentRole: string;
}

// GET - Fetch weekly payouts for a user
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const weekStartParam = searchParams.get("week_start");
    const userId = searchParams.get("user_id") || session.user.id;

    // Only allow viewing own payouts (or downline for managers - TODO)
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
      },
    });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // Fetch payouts for the week
    const payouts = await prisma.payouts.findMany({
      where: {
        user_id: userId,
        deposit_date: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      include: {
        deals: {
          select: {
            id: true,
            client_name: true,
            effective_date: true,
            deposit_date: true,
            annual_premium: true,
            agent_id: true,
            users_deals_agent_idTousers: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                role: true,
              },
            },
          },
        },
      },
    });

    // Calculate totals
    let personalCommission = 0;
    let overrideEarnings = 0;
    const deals: PayoutDeal[] = [];

    for (const payout of payouts) {
      const amount = Number(payout.amount);

      if (payout.type === "BASE_COMMISSION") {
        personalCommission += amount;
      } else {
        overrideEarnings += amount;
      }

      const agent = payout.deals.users_deals_agent_idTousers;
      const isPersonal = payout.deals.agent_id === userId;

      deals.push({
        dealId: payout.deals.id,
        clientName: payout.deals.client_name,
        effectiveDate: payout.deals.effective_date?.toISOString() || null,
        depositDate: payout.deals.deposit_date?.toISOString() || payout.deposit_date.toISOString(),
        premium: Number(payout.deals.annual_premium),
        yourEarnings: amount,
        type: isPersonal ? "personal" : "override",
        agent: isPersonal ? "You" : `${agent.first_name} ${agent.last_name}`,
        agentRole: agent.role,
      });
    }

    // Build daily breakdown
    const weekDates = getWeekDates(weekStart);
    const dailyBreakdown: DailyBreakdown = {};

    for (const date of weekDates) {
      const dayName = getDayName(date);
      dailyBreakdown[dayName] = {
        date: formatDateForDB(date),
        amount: 0,
      };
    }

    // Aggregate amounts by day
    for (const payout of payouts) {
      const depositDate = new Date(payout.deposit_date);
      const dayName = getDayName(depositDate);
      if (dailyBreakdown[dayName]) {
        dailyBreakdown[dayName].amount += Number(payout.amount);
      }
    }

    // Count deals by type
    const personalDeals = deals.filter(d => d.type === "personal").length;
    const overrideDeals = deals.filter(d => d.type === "override").length;

    return NextResponse.json({
      userId: user.id,
      userName: `${user.first_name} ${user.last_name}`,
      userLevel: user.role,
      weekStart: formatDateForDB(weekStart),
      weekEnd: formatDateForDB(weekEnd),
      weekDisplay: formatWeekRange(weekStart, weekEnd),
      payouts: {
        personalCommission,
        overrideEarnings,
        total: personalCommission + overrideEarnings,
        personalDeals,
        overrideDeals,
        totalDeals: deals.length,
      },
      deals: deals.sort((a, b) =>
        new Date(a.depositDate).getTime() - new Date(b.depositDate).getTime()
      ),
      dailyBreakdown,
    });
  } catch (error) {
    console.error("Error fetching weekly payouts:", error);
    return NextResponse.json({ message: "Failed to fetch payouts" }, { status: 500 });
  }
}
