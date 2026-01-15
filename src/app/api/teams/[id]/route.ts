import { NextResponse } from "next/server";
import { getServerSession, authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const team = await prisma.teams.findUnique({
      where: { id },
      include: {
        users_teams_team_leader_idTousers: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            profile_photo_url: true,
          },
        },
        users_users_team_idToteams: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            profile_photo_url: true,
            role: true,
            email: true,
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json({ message: "Team not found" }, { status: 404 });
    }

    // Get team production stats
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const memberIds = team.users_users_team_idToteams.map((u) => u.id);

    const deals = await prisma.deals.findMany({
      where: {
        agent_id: { in: memberIds },
        created_at: { gte: startOfMonth },
      },
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

    // Aggregate stats by member
    const memberStats = new Map<string, { deals: number; premium: number }>();
    deals.forEach((deal) => {
      const existing = memberStats.get(deal.agent_id) || { deals: 0, premium: 0 };
      existing.deals += 1;
      existing.premium += Number(deal.annual_premium);
      memberStats.set(deal.agent_id, existing);
    });

    const membersWithStats = team.users_users_team_idToteams
      .map((member) => ({
        id: member.id,
        firstName: member.first_name,
        lastName: member.last_name,
        profilePhotoUrl: member.profile_photo_url,
        role: member.role,
        email: member.email,
        stats: memberStats.get(member.id) || { deals: 0, premium: 0 },
      }))
      .sort((a, b) => b.stats.premium - a.stats.premium);

    const totalDeals = deals.length;
    const totalPremium = deals.reduce((sum, d) => sum + Number(d.annual_premium), 0);

    return NextResponse.json({
      id: team.id,
      name: team.name,
      description: team.description,
      color: team.color,
      emoji: team.emoji,
      monthlyDealGoal: team.monthly_deal_goal,
      monthlyPremiumGoal: team.monthly_premium_goal ? Number(team.monthly_premium_goal) : null,
      createdAt: team.created_at,
      leader: team.users_teams_team_leader_idTousers
        ? {
            id: team.users_teams_team_leader_idTousers.id,
            firstName: team.users_teams_team_leader_idTousers.first_name,
            lastName: team.users_teams_team_leader_idTousers.last_name,
            profilePhotoUrl: team.users_teams_team_leader_idTousers.profile_photo_url,
          }
        : null,
      members: membersWithStats,
      memberCount: team.users_users_team_idToteams.length,
      stats: {
        deals: totalDeals,
        premium: totalPremium,
      },
    });
  } catch (error) {
    console.error("Error fetching team:", error);
    return NextResponse.json({ message: "Failed to fetch team" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!["AO", "PARTNER"].includes(session.user.role || "")) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, description, color, emoji, team_leader_id, monthly_deal_goal, monthly_premium_goal } = body;

    const existing = await prisma.teams.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: "Team not found" }, { status: 404 });
    }

    if (name && name !== existing.name) {
      const nameConflict = await prisma.teams.findUnique({ where: { name } });
      if (nameConflict) {
        return NextResponse.json({ message: "Team with this name already exists" }, { status: 400 });
      }
    }

    const team = await prisma.teams.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(color !== undefined && { color }),
        ...(emoji !== undefined && { emoji }),
        ...(team_leader_id !== undefined && { team_leader_id }),
        ...(monthly_deal_goal !== undefined && { monthly_deal_goal }),
        ...(monthly_premium_goal !== undefined && { monthly_premium_goal }),
        updated_at: new Date(),
      },
    });

    return NextResponse.json(team);
  } catch (error) {
    console.error("Error updating team:", error);
    return NextResponse.json({ message: "Failed to update team" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!["AO", "PARTNER"].includes(session.user.role || "")) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // First, remove team from all members
    await prisma.users.updateMany({
      where: { team_id: id },
      data: { team_id: null },
    });

    // Then delete the team
    await prisma.teams.delete({ where: { id } });

    return NextResponse.json({ message: "Team deleted" });
  } catch (error) {
    console.error("Error deleting team:", error);
    return NextResponse.json({ message: "Failed to delete team" }, { status: 500 });
  }
}
