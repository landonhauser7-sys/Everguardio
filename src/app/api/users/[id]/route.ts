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

    // Users can view their own profile, admins can view anyone
    if (session.user.role !== "ADMIN" && session.user.id !== id) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const user = await prisma.users.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        display_name: true,
        role: true,
        status: true,
        profile_photo_url: true,
        phone_number: true,
        commission_level: true,
        manager_id: true,
        agency_owner_id: true,
        team_id: true,
        weekly_deal_goal: true,
        monthly_premium_goal: true,
        created_at: true,
        teams_users_team_idToteams: {
          select: { id: true, name: true },
        },
        users_users_manager_idTousers: {
          select: { id: true, first_name: true, last_name: true },
        },
        users_users_agency_owner_idTousers: {
          select: { id: true, first_name: true, last_name: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      displayName: user.display_name,
      role: user.role,
      status: user.status,
      profilePhotoUrl: user.profile_photo_url,
      phoneNumber: user.phone_number,
      commissionLevel: user.commission_level,
      managerId: user.manager_id,
      agencyOwnerId: user.agency_owner_id,
      teamId: user.team_id,
      weeklyDealGoal: user.weekly_deal_goal,
      monthlyPremiumGoal: user.monthly_premium_goal ? Number(user.monthly_premium_goal) : null,
      createdAt: user.created_at,
      team: user.teams_users_team_idToteams,
      manager: user.users_users_manager_idTousers ? {
        id: user.users_users_manager_idTousers.id,
        name: `${user.users_users_manager_idTousers.first_name} ${user.users_users_manager_idTousers.last_name}`,
      } : null,
      agencyOwner: user.users_users_agency_owner_idTousers ? {
        id: user.users_users_agency_owner_idTousers.id,
        name: `${user.users_users_agency_owner_idTousers.first_name} ${user.users_users_agency_owner_idTousers.last_name}`,
      } : null,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json({ message: "Failed to fetch user" }, { status: 500 });
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

    const { id } = await params;

    // Only admins can update other users
    if (session.user.role !== "ADMIN" && session.user.id !== id) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      firstName,
      lastName,
      displayName,
      role,
      status,
      teamId,
      commissionLevel,
      managerId,
      agencyOwnerId,
      weeklyDealGoal,
      monthlyPremiumGoal,
    } = body;

    // Non-admins can only update certain fields
    const isAdmin = session.user.role === "ADMIN";

    const updateData: Record<string, unknown> = {
      updated_at: new Date(),
    };

    // Fields anyone can update on their own profile
    if (firstName !== undefined) updateData.first_name = firstName;
    if (lastName !== undefined) updateData.last_name = lastName;
    if (displayName !== undefined) updateData.display_name = displayName;

    // Admin-only fields
    if (isAdmin) {
      if (role !== undefined) updateData.role = role;
      if (status !== undefined) updateData.status = status;
      if (teamId !== undefined) updateData.team_id = teamId || null;
      if (commissionLevel !== undefined) updateData.commission_level = commissionLevel;
      if (managerId !== undefined) updateData.manager_id = managerId || null;
      if (agencyOwnerId !== undefined) updateData.agency_owner_id = agencyOwnerId || null;
      if (weeklyDealGoal !== undefined) updateData.weekly_deal_goal = weeklyDealGoal;
      if (monthlyPremiumGoal !== undefined) updateData.monthly_premium_goal = monthlyPremiumGoal;
    }

    const user = await prisma.users.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      id: user.id,
      message: "User updated successfully",
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ message: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Prevent deleting yourself
    if (session.user.id === id) {
      return NextResponse.json({ message: "Cannot delete your own account" }, { status: 400 });
    }

    // Check if user has deals
    const dealCount = await prisma.deals.count({
      where: { agent_id: id },
    });

    if (dealCount > 0) {
      // Deactivate instead of delete
      await prisma.users.update({
        where: { id },
        data: { status: "TERMINATED", updated_at: new Date() },
      });
      return NextResponse.json({ message: "User deactivated (has deal history)" });
    }

    await prisma.users.delete({ where: { id } });
    return NextResponse.json({ message: "User deleted" });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json({ message: "Failed to delete user" }, { status: 500 });
  }
}
