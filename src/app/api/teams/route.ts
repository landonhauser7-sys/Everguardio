import { NextResponse } from "next/server";
import { getServerSession, authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { randomUUID } from "crypto";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeStats = searchParams.get("includeStats") === "true";

    const teams = await prisma.teams.findMany({
      orderBy: { name: "asc" },
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
          },
        },
      },
    });

    // If stats requested, get deal data
    if (includeStats) {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const deals = await prisma.deals.findMany({
        where: {
          created_at: { gte: startOfMonth },
        },
        select: {
          agent_id: true,
          annual_premium: true,
        },
      });

      // Build agent to team map
      const agentTeamMap = new Map<string, string>();
      teams.forEach((team) => {
        team.users_users_team_idToteams.forEach((user) => {
          agentTeamMap.set(user.id, team.id);
        });
      });

      // Aggregate deals by team
      const teamStats = new Map<string, { deals: number; premium: number }>();
      deals.forEach((deal) => {
        const teamId = agentTeamMap.get(deal.agent_id);
        if (teamId) {
          const existing = teamStats.get(teamId) || { deals: 0, premium: 0 };
          existing.deals += 1;
          existing.premium += Number(deal.annual_premium);
          teamStats.set(teamId, existing);
        }
      });

      const teamsWithStats = teams.map((team) => ({
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
        members: team.users_users_team_idToteams.map((u) => ({
          id: u.id,
          firstName: u.first_name,
          lastName: u.last_name,
          profilePhotoUrl: u.profile_photo_url,
          role: u.role,
        })),
        memberCount: team.users_users_team_idToteams.length,
        stats: teamStats.get(team.id) || { deals: 0, premium: 0 },
      }));

      return NextResponse.json(teamsWithStats);
    }

    // Simple response without stats
    const teamsSimple = teams.map((team) => ({
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
      members: team.users_users_team_idToteams.map((u) => ({
        id: u.id,
        firstName: u.first_name,
        lastName: u.last_name,
        profilePhotoUrl: u.profile_photo_url,
        role: u.role,
      })),
      memberCount: team.users_users_team_idToteams.length,
    }));

    return NextResponse.json(teamsSimple);
  } catch (error) {
    console.error("Error fetching teams:", error);
    return NextResponse.json({ message: "Failed to fetch teams" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!["AO", "PARTNER"].includes(session.user.role || "")) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, color, emoji, team_leader_id, monthly_deal_goal, monthly_premium_goal } = body;

    if (!name) {
      return NextResponse.json({ message: "Team name is required" }, { status: 400 });
    }

    const existing = await prisma.teams.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json({ message: "Team with this name already exists" }, { status: 400 });
    }

    const team = await prisma.teams.create({
      data: {
        id: randomUUID(),
        name,
        description: description || null,
        color: color || null,
        emoji: emoji || null,
        team_leader_id: team_leader_id || null,
        monthly_deal_goal: monthly_deal_goal ?? 50,
        monthly_premium_goal: monthly_premium_goal ?? 150000,
        updated_at: new Date(),
      },
    });

    return NextResponse.json(team, { status: 201 });
  } catch (error) {
    console.error("Error creating team:", error);
    return NextResponse.json({ message: "Failed to create team" }, { status: 500 });
  }
}
