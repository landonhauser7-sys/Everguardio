import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { id: teamId } = await params;
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ message: "User ID is required" }, { status: 400 });
    }

    // Verify team exists
    const team = await prisma.teams.findUnique({ where: { id: teamId } });
    if (!team) {
      return NextResponse.json({ message: "Team not found" }, { status: 404 });
    }

    // Add user to team
    await prisma.users.update({
      where: { id: userId },
      data: { team_id: teamId },
    });

    return NextResponse.json({ message: "Member added to team" });
  } catch (error) {
    console.error("Error adding team member:", error);
    return NextResponse.json({ message: "Failed to add team member" }, { status: 500 });
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

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { id: teamId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ message: "User ID is required" }, { status: 400 });
    }

    // Remove user from team
    await prisma.users.update({
      where: { id: userId },
      data: { team_id: null },
    });

    return NextResponse.json({ message: "Member removed from team" });
  } catch (error) {
    console.error("Error removing team member:", error);
    return NextResponse.json({ message: "Failed to remove team member" }, { status: 500 });
  }
}
