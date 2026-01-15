import { NextRequest, NextResponse } from "next/server";
import { getServerSession, authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET - Fetch all onboarding tracker data
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = ["AO", "PARTNER"].includes(session.user.role || "");
    const isManager = ["GA", "MGA", "PARTNER", "AO"].includes(session.user.role || "");

    // Get all active carriers for the columns
    const carriers = await prisma.carriers.findMany({
      where: { is_active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    });

    // Build where clause based on role
    let userWhereClause: Record<string, unknown> = {};
    if (!isAdmin && !isManager) {
      // Agents can only see their own data
      userWhereClause = { id: session.user.id };
    } else if (isManager && !isAdmin) {
      // Managers can see their team's data
      userWhereClause = {
        OR: [
          { id: session.user.id },
          { team_id: session.user.teamId },
        ],
      };
    }
    // Admins can see all

    // Get users with their onboarding data
    const users = await prisma.users.findMany({
      where: {
        ...userWhereClause,
        status: { in: ["ACTIVE", "INACTIVE"] },
      },
      orderBy: [{ created_at: "desc" }],
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        team_id: true,
        created_at: true,
        teams_users_team_idToteams: {
          select: { id: true, name: true },
        },
        onboarding_tracker: {
          select: {
            id: true,
            date_added: true,
            overall_status: true,
            progress_percentage: true,
            notes: true,
            carrier_statuses: {
              select: {
                id: true,
                carrier_id: true,
                status: true,
                date_submitted: true,
                date_approved: true,
                notes: true,
              },
            },
          },
        },
      },
    });

    // Transform data for frontend
    const onboardingData = users.map((user) => {
      const tracker = user.onboarding_tracker;
      const carrierStatusMap: Record<string, {
        status: string;
        dateSubmitted: string | null;
        dateApproved: string | null;
        notes: string | null;
      }> = {};

      // Initialize all carriers as NOT_STARTED
      carriers.forEach((carrier) => {
        carrierStatusMap[carrier.id] = {
          status: "NOT_STARTED",
          dateSubmitted: null,
          dateApproved: null,
          notes: null,
        };
      });

      // Override with actual statuses from tracker
      if (tracker?.carrier_statuses) {
        tracker.carrier_statuses.forEach((cs) => {
          carrierStatusMap[cs.carrier_id] = {
            status: cs.status,
            dateSubmitted: cs.date_submitted?.toISOString() || null,
            dateApproved: cs.date_approved?.toISOString() || null,
            notes: cs.notes,
          };
        });
      }

      // Calculate progress
      const totalCarriers = carriers.length;
      const completedCarriers = Object.values(carrierStatusMap).filter(
        (cs) => cs.status === "COMPLETED"
      ).length;
      const progressPercentage = totalCarriers > 0
        ? Math.round((completedCarriers / totalCarriers) * 100)
        : 0;

      // Determine overall status
      let overallStatus = "NOT_STARTED";
      if (completedCarriers === totalCarriers && totalCarriers > 0) {
        overallStatus = "READY";
      } else if (completedCarriers > 0 || Object.values(carrierStatusMap).some(cs => cs.status === "IN_PROGRESS")) {
        overallStatus = "PENDING";
      }

      return {
        id: user.id,
        trackerId: tracker?.id || null,
        agentName: `${user.first_name} ${user.last_name}`,
        email: user.email,
        teamId: user.team_id,
        teamName: user.teams_users_team_idToteams?.name || null,
        dateAdded: tracker?.date_added?.toISOString() || user.created_at.toISOString(),
        overallStatus,
        progressPercentage,
        notes: tracker?.notes || null,
        carrierStatuses: carrierStatusMap,
      };
    });

    // Calculate summary stats
    const totalAgents = onboardingData.length;
    const readyCount = onboardingData.filter((d) => d.overallStatus === "READY").length;
    const pendingCount = onboardingData.filter((d) => d.overallStatus === "PENDING").length;
    const notStartedCount = onboardingData.filter((d) => d.overallStatus === "NOT_STARTED").length;
    const avgProgress = totalAgents > 0
      ? Math.round(onboardingData.reduce((sum, d) => sum + d.progressPercentage, 0) / totalAgents)
      : 0;

    return NextResponse.json({
      carriers,
      agents: onboardingData,
      summary: {
        totalAgents,
        readyCount,
        pendingCount,
        notStartedCount,
        avgProgress,
      },
    });
  } catch (error) {
    console.error("Error fetching onboarding data:", error);
    return NextResponse.json({ message: "Failed to fetch onboarding data" }, { status: 500 });
  }
}

// POST - Add a new agent to the tracker
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !["AO", "PARTNER"].includes(session.user.role || "")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { userId, initializeCarriers = true } = body;

    if (!userId) {
      return NextResponse.json({ message: "User ID is required" }, { status: 400 });
    }

    // Check if tracker already exists
    const existingTracker = await prisma.onboarding_tracker.findUnique({
      where: { user_id: userId },
    });

    if (existingTracker) {
      return NextResponse.json({ message: "Tracker already exists for this user" }, { status: 400 });
    }

    // Create tracker
    const tracker = await prisma.onboarding_tracker.create({
      data: {
        id: crypto.randomUUID(),
        user_id: userId,
        overall_status: "NOT_STARTED",
        progress_percentage: 0,
        updated_at: new Date(),
      },
    });

    // Initialize all carriers if requested
    if (initializeCarriers) {
      const carriers = await prisma.carriers.findMany({
        where: { is_active: true },
        select: { id: true },
      });

      await prisma.carrier_onboarding_status.createMany({
        data: carriers.map((carrier) => ({
          id: crypto.randomUUID(),
          onboarding_id: tracker.id,
          carrier_id: carrier.id,
          status: "NOT_STARTED" as const,
          updated_at: new Date(),
        })),
      });
    }

    return NextResponse.json({
      id: tracker.id,
      message: "Agent added to tracker successfully",
    });
  } catch (error) {
    console.error("Error adding agent to tracker:", error);
    return NextResponse.json({ message: "Failed to add agent to tracker" }, { status: 500 });
  }
}

// PATCH - Update carrier status for an agent
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { userId, carrierId, status, dateSubmitted, dateApproved, notes, trackerNotes } = body;

    if (!userId) {
      return NextResponse.json({ message: "User ID is required" }, { status: 400 });
    }

    // Check permissions
    const isAdmin = ["AO", "PARTNER"].includes(session.user.role || "");
    const isManager = ["GA", "MGA", "PARTNER", "AO"].includes(session.user.role || "");

    if (!isAdmin && !isManager && session.user.id !== userId) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    // Get or create tracker
    let tracker = await prisma.onboarding_tracker.findUnique({
      where: { user_id: userId },
    });

    if (!tracker) {
      // Create tracker if it doesn't exist
      tracker = await prisma.onboarding_tracker.create({
        data: {
          id: crypto.randomUUID(),
          user_id: userId,
          overall_status: "NOT_STARTED",
          progress_percentage: 0,
          updated_at: new Date(),
        },
      });
    }

    // Update tracker notes if provided
    if (trackerNotes !== undefined) {
      await prisma.onboarding_tracker.update({
        where: { id: tracker.id },
        data: {
          notes: trackerNotes,
          updated_at: new Date(),
        },
      });
    }

    // Update carrier status if carrierId provided
    if (carrierId && status) {
      await prisma.carrier_onboarding_status.upsert({
        where: {
          onboarding_id_carrier_id: {
            onboarding_id: tracker.id,
            carrier_id: carrierId,
          },
        },
        create: {
          id: crypto.randomUUID(),
          onboarding_id: tracker.id,
          carrier_id: carrierId,
          status,
          date_submitted: dateSubmitted ? new Date(dateSubmitted) : null,
          date_approved: dateApproved ? new Date(dateApproved) : null,
          notes: notes || null,
          updated_at: new Date(),
        },
        update: {
          status,
          date_submitted: dateSubmitted ? new Date(dateSubmitted) : null,
          date_approved: dateApproved ? new Date(dateApproved) : null,
          notes: notes || null,
          updated_at: new Date(),
        },
      });

      // Recalculate progress and overall status
      const carriers = await prisma.carriers.findMany({
        where: { is_active: true },
        select: { id: true },
      });

      const carrierStatuses = await prisma.carrier_onboarding_status.findMany({
        where: { onboarding_id: tracker.id },
      });

      const completedCount = carrierStatuses.filter((cs) => cs.status === "COMPLETED").length;
      const inProgressCount = carrierStatuses.filter((cs) => cs.status === "IN_PROGRESS").length;
      const totalCarriers = carriers.length;
      const progressPercentage = totalCarriers > 0 ? Math.round((completedCount / totalCarriers) * 100) : 0;

      let overallStatus: "NOT_STARTED" | "PENDING" | "READY" = "NOT_STARTED";
      if (completedCount === totalCarriers && totalCarriers > 0) {
        overallStatus = "READY";
      } else if (completedCount > 0 || inProgressCount > 0) {
        overallStatus = "PENDING";
      }

      await prisma.onboarding_tracker.update({
        where: { id: tracker.id },
        data: {
          overall_status: overallStatus,
          progress_percentage: progressPercentage,
          updated_at: new Date(),
        },
      });
    }

    return NextResponse.json({ message: "Updated successfully" });
  } catch (error) {
    console.error("Error updating onboarding status:", error);
    return NextResponse.json({ message: "Failed to update status" }, { status: 500 });
  }
}
