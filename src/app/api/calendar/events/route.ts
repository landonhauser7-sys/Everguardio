import { NextResponse } from "next/server";
import { getServerSession, authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const eventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(["training", "meeting", "announcement", "deadline", "other"]),
  visibility: z.enum(["personal", "hierarchy", "agency"]).optional().default("personal"),
  start: z.string(),
  end: z.string(),
  location: z.string().optional(),
  allDay: z.boolean().optional(),
});

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

// Get all upline user IDs
async function getAllUplineIds(userId: string): Promise<string[]> {
  const uplineIds: string[] = [];
  let currentId: string | null = userId;
  const visited = new Set<string>();

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const user: { upline_id: string | null } | null = await prisma.users.findUnique({
      where: { id: currentId },
      select: { upline_id: true },
    });
    if (user?.upline_id) {
      uplineIds.push(user.upline_id);
      currentId = user.upline_id;
    } else {
      break;
    }
  }

  return uplineIds;
}

// GET - Fetch calendar events
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");

    const start = startParam ? new Date(startParam) : new Date();
    const end = endParam ? new Date(endParam) : new Date();

    // Get upline IDs to see hierarchy events from managers above
    const uplineIds = await getAllUplineIds(session.user.id);

    // Fetch events from database with visibility filtering
    // User can see:
    // 1. AGENCY events (everyone sees these)
    // 2. PERSONAL events they created or are targeted to them
    // 3. HIERARCHY events created by their upline managers
    const events = await prisma.calendar_events.findMany({
      where: {
        start: {
          gte: start,
        },
        end: {
          lte: new Date(end.getTime() + 24 * 60 * 60 * 1000),
        },
        OR: [
          // Agency-wide events
          { visibility: "AGENCY" },
          // Personal events created by user
          { visibility: "PERSONAL", created_by_id: session.user.id },
          // Personal events targeted to user
          { visibility: "PERSONAL", target_user_id: session.user.id },
          // Hierarchy events from upline managers
          { visibility: "HIERARCHY", created_by_id: { in: uplineIds } },
          // Hierarchy events user created for their downline
          { visibility: "HIERARCHY", created_by_id: session.user.id },
        ],
      },
      orderBy: { start: "asc" },
      include: {
        users: {
          select: { first_name: true, last_name: true },
        },
      },
    });

    // Get config
    const config = await prisma.calendar_config.findFirst();

    // Check if user is manager (can create hierarchy events)
    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { is_manager: true, commission_level: true },
    });
    const isManager = user?.is_manager || (user?.commission_level && user.commission_level >= 80);

    return NextResponse.json({
      events: events.map((event) => ({
        id: event.id,
        title: event.title,
        description: event.description,
        start: event.start.toISOString(),
        end: event.end.toISOString(),
        location: event.location,
        type: event.type.toLowerCase(),
        visibility: event.visibility.toLowerCase(),
        allDay: event.all_day,
        hangoutLink: event.hangout_link,
        createdBy: event.users ? `${event.users.first_name} ${event.users.last_name}` : null,
        isOwn: event.created_by_id === session.user.id,
      })),
      config: {
        connected: config?.is_connected || false,
        calendarId: config?.google_calendar_id,
        lastSynced: config?.last_synced?.toISOString(),
      },
      isManager,
    });
  } catch (error) {
    console.error("Error fetching calendar events:", error);
    return NextResponse.json(
      { message: "Failed to fetch calendar events" },
      { status: 500 }
    );
  }
}

// POST - Create a new calendar event
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = eventSchema.parse(body);

    // Get user info to check permissions
    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { is_manager: true, commission_level: true, role: true },
    });

    const isAdmin = ["AO", "PARTNER"].includes(user?.role || "");
    const isManager = user?.is_manager || (user?.commission_level && user.commission_level >= 80);

    // Validate visibility permissions
    const visibility = validatedData.visibility?.toUpperCase() || "PERSONAL";

    // Only admins can create AGENCY events
    if (visibility === "AGENCY" && !isAdmin) {
      return NextResponse.json(
        { message: "Only admins can create agency-wide events" },
        { status: 403 }
      );
    }

    // Only managers can create HIERARCHY events
    if (visibility === "HIERARCHY" && !isManager) {
      return NextResponse.json(
        { message: "Only managers can create hierarchy events" },
        { status: 403 }
      );
    }

    // All users can create PERSONAL events

    const eventId = crypto.randomUUID();
    const event = await prisma.calendar_events.create({
      data: {
        id: eventId,
        title: validatedData.title,
        description: validatedData.description,
        type: validatedData.type.toUpperCase() as "TRAINING" | "MEETING" | "ANNOUNCEMENT" | "DEADLINE" | "OTHER",
        visibility: visibility as "PERSONAL" | "HIERARCHY" | "AGENCY",
        start: new Date(validatedData.start),
        end: new Date(validatedData.end),
        location: validatedData.location,
        all_day: validatedData.allDay || false,
        created_by_id: session.user.id,
        target_user_id: visibility === "PERSONAL" ? session.user.id : null,
        updated_at: new Date(),
      },
    });

    return NextResponse.json({
      id: event.id,
      message: "Event created successfully",
    });
  } catch (error) {
    console.error("Error creating calendar event:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0].message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "Failed to create calendar event" },
      { status: 500 }
    );
  }
}
